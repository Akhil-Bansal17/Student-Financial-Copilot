import asyncio
import datetime
import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User
from app.models.account import ConnectedAccount, AccountConsent
from app.services.bank_sync_service import BankSyncService

logger = logging.getLogger("bank_sync_scheduler")


class BankSyncScheduler:
    """
    Background scheduler for automated, periodic bank synchronization and reconciliation.
    Safely discovers eligible active accounts, checks consent validity,
    respects concurrency locks, and handles retries with backoff.
    """

    def __init__(self):
        self._task: Optional[asyncio.Task] = None
        self._running: bool = False

    @staticmethod
    def get_eligible_accounts(db: Session) -> List[ConnectedAccount]:
        """
        Query accounts eligible for automatic background synchronization:
        - status == 'ACTIVE'
        - Active consent exists (status='ACTIVE' and expires_at > now or null)
        - Not currently locked by another worker (or lock expired)
        - Either:
          1. Never synced (last_synced_at is null)
          2. Interval elapsed (last_synced_at <= now - BANK_SYNC_INTERVAL_MINUTES)
          3. Next retry time reached (next_retry_at <= now)
        """
        now = datetime.datetime.now(datetime.timezone.utc)
        sync_interval = datetime.timedelta(minutes=settings.BANK_SYNC_INTERVAL_MINUTES)
        lock_timeout = datetime.timedelta(seconds=settings.BANK_SYNC_LOCK_TIMEOUT_SECONDS)

        all_active_accounts = (
            db.query(ConnectedAccount)
            .filter(ConnectedAccount.status == "ACTIVE")
            .all()
        )

        eligible: List[ConnectedAccount] = []

        for acc in all_active_accounts:
            # 1. Concurrency lock check
            if acc.sync_lock_at is not None:
                if (now - acc.sync_lock_at) < lock_timeout:
                    # Currently locked by another worker
                    continue

            # 2. Consent check
            active_consent = (
                db.query(AccountConsent)
                .filter(
                    AccountConsent.account_id == acc.id,
                    AccountConsent.status == "ACTIVE",
                )
                .first()
            )
            if not active_consent:
                continue

            if active_consent.expires_at is not None:
                exp = active_consent.expires_at
                if exp.tzinfo is None:
                    exp = exp.replace(tzinfo=datetime.timezone.utc)
                if exp <= now:
                    continue

            # 3. Schedule / freshness check
            if acc.next_retry_at is not None:
                next_retry = acc.next_retry_at
                if next_retry.tzinfo is None:
                    next_retry = next_retry.replace(tzinfo=datetime.timezone.utc)
                if next_retry <= now:
                    eligible.append(acc)
                    continue

            if acc.last_synced_at is None:
                eligible.append(acc)
                continue

            last_sync = acc.last_synced_at
            if last_sync.tzinfo is None:
                last_sync = last_sync.replace(tzinfo=datetime.timezone.utc)

            if (now - last_sync) >= sync_interval:
                eligible.append(acc)

        return eligible

    @classmethod
    def run_sync_cycle(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Execute one complete automatic synchronization cycle across all eligible accounts.
        Can be invoked by the scheduler loop, tests, or management endpoints.
        """
        if not settings.BANK_SYNC_ENABLED:
            logger.info("Automatic bank sync is disabled by configuration (BANK_SYNC_ENABLED=False).")
            return {
                "status": "DISABLED",
                "accounts_evaluated": 0,
                "accounts_synced": 0,
                "accounts_failed": 0,
                "details": [],
            }

        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True

        try:
            eligible_accounts = cls.get_eligible_accounts(db)
            logger.info(f"Found {len(eligible_accounts)} accounts eligible for automatic sync.")

            results: List[Dict[str, Any]] = []
            synced_count = 0
            failed_count = 0

            for acc in eligible_accounts:
                user = db.query(User).filter(User.id == acc.user_id).first()
                if not user:
                    continue

                trigger = "RETRY" if acc.sync_retry_count > 0 else "AUTOMATIC"

                try:
                    sync_run = BankSyncService.sync_account(
                        db=db,
                        user=user,
                        account_id=acc.id,
                        trigger_type=trigger,
                    )
                    synced_count += 1
                    results.append({
                        "account_id": acc.id,
                        "status": "SUCCESS",
                        "trigger": trigger,
                        "transactions_imported": sync_run.transactions_imported,
                        "transactions_reconciled": sync_run.transactions_reconciled,
                        "transactions_pending_review": sync_run.transactions_pending_review,
                    })
                except Exception as exc:
                    failed_count += 1
                    logger.warning(f"Auto-sync failed for account {acc.id}: {exc}")
                    results.append({
                        "account_id": acc.id,
                        "status": "FAILED",
                        "trigger": trigger,
                        "error": str(exc),
                    })

            return {
                "status": "COMPLETED",
                "accounts_evaluated": len(eligible_accounts),
                "accounts_synced": synced_count,
                "accounts_failed": failed_count,
                "details": results,
            }
        finally:
            if should_close:
                db.close()

    @classmethod
    def _run_alerts_cycle(cls):
        """Execute automated smart alert evaluation cycle across all active users."""
        from app.services.smart_alert_service import SmartAlertService
        db = SessionLocal()
        try:
            SmartAlertService.evaluate_all_users_alerts(db)
        except Exception as exc:
            logger.warning(f"Error evaluating smart alerts in background scheduler: {exc}")
        finally:
            db.close()

    async def _scheduler_loop(self):
        logger.info(f"Starting automatic bank sync and smart alert scheduler loop (interval: {settings.BANK_SYNC_INTERVAL_MINUTES}m).")
        while self._running:
            try:
                # Run sync cycle in worker thread with fresh DB session
                await asyncio.to_thread(self.run_sync_cycle)
                # Run smart alert evaluation in worker thread with fresh DB session
                await asyncio.to_thread(self._run_alerts_cycle)
            except Exception as exc:
                logger.error(f"Error executing scheduler cycle: {exc}", exc_info=True)

            # Sleep until next check (minimum 60s check frequency)
            check_sleep = max(60, settings.BANK_SYNC_INTERVAL_MINUTES * 60)
            try:
                await asyncio.sleep(check_sleep)
            except asyncio.CancelledError:
                break
        logger.info("Automatic bank sync scheduler loop stopped.")

    def start(self):
        """Start the background scheduler task."""
        if not settings.BANK_SYNC_ENABLED:
            logger.info("Automatic bank sync scheduler is disabled (BANK_SYNC_ENABLED=False).")
            return

        if self._running:
            return

        self._running = True
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._scheduler_loop())
        except RuntimeError:
            # No running event loop in current thread/context (e.g. unit test)
            pass

    def stop(self):
        """Stop the background scheduler task cleanly."""
        if not self._running:
            return

        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None


# Global scheduler instance
scheduler = BankSyncScheduler()
