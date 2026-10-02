import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.user import User
from app.services.recurring_expense_service import RecurringExpenseService


def backfill_all_users() -> None:
    """
    Safely runs deterministic recurring pattern detection across all existing users.
    Existing transactions, balances, budgets, and goals remain untouched.
    """
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Starting recurring intelligence backfill for {len(users)} user(s)...")
        total_created = 0
        for user in users:
            detected = RecurringExpenseService.detect_and_sync_recurring(db, user.id)
            total_created += len(detected)
            print(f"  User #{user.id} ({user.email}): detected {len(detected)} recurring expense(s)")
        print(f"Backfill complete! Synchronized {total_created} recurring record(s).")
    finally:
        db.close()


if __name__ == "__main__":
    backfill_all_users()
