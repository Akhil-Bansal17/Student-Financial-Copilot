import base64
import hashlib
import hmac
import json
import time
import uuid
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
from app.core.config import settings


def generate_consent_state(
    user_id: int,
    consent_id: str,
    provider: str = "setu_aa",
    expires_in_seconds: int = 900,  # 15 minutes validity
) -> str:
    """
    Generate a tamper-proof, cryptographically signed state token for Account Aggregator consent flows.
    Ties the authorization transaction directly to the user_id, provider, and consent_id to prevent CSRF,
    parameter tampering, and unauthorized callbacks.
    """
    now = int(time.time())
    payload: Dict[str, Any] = {
        "sub": user_id,
        "cid": consent_id,
        "prv": provider,
        "nonce": str(uuid.uuid4()),
        "iat": now,
        "exp": now + expires_in_seconds,
    }

    payload_json = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")

    signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"{payload_b64}.{signature}"


def verify_consent_state(
    state_token: str,
    expected_user_id: Optional[int] = None,
    expected_consent_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Verify and decode a consent state token.
    Enforces HMAC-SHA256 signature validity, expiry, and optional user/consent binding.
    """
    if not state_token or "." not in state_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or malformed state token format",
        )

    parts = state_token.split(".")
    if len(parts) != 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed state token structure",
        )

    payload_b64, signature = parts

    # Compute expected signature
    expected_signature = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="State token signature verification failed (tampered or forged token)",
        )

    # Decode base64 payload
    padding = "=" * (4 - (len(payload_b64) % 4)) if len(payload_b64) % 4 != 0 else ""
    try:
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + padding)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to decode state token payload",
        )

    # Expiry verification
    now = int(time.time())
    if payload.get("exp", 0) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Consent state token has expired. Please initiate connection again.",
        )

    # Enforce strict user isolation
    if expected_user_id is not None and payload.get("sub") != expected_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="State token user mismatch: callback does not match authenticated user session",
        )

    # Enforce consent binding
    if expected_consent_id is not None and payload.get("cid") != expected_consent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State token consent identifier mismatch",
        )

    return payload
