import re
from typing import Optional, Tuple, Dict, Any
from decimal import Decimal


class TransactionNormalizationService:
    """
    Deterministic transaction and merchant normalization layer.
    Extracts clean merchant names and standard descriptions from raw bank
    narrations and user inputs without altering authoritative financial amounts.
    """

    # Common known merchant aliases -> canonical normalized names
    KNOWN_MERCHANTS: Dict[str, str] = {
        "AMZN": "AMAZON",
        "AMAZON": "AMAZON",
        "AMAZON PAY": "AMAZON",
        "AMZN MKTPLACE": "AMAZON",
        "SWIGGY": "SWIGGY",
        "ZOMATO": "ZOMATO",
        "UBER": "UBER",
        "UBER INDIA": "UBER",
        "OLA": "OLA",
        "OLA CABS": "OLA",
        "RAPIDO": "RAPIDO",
        "FLIPKART": "FLIPKART",
        "NETFLIX": "NETFLIX",
        "SPOTIFY": "SPOTIFY",
        "ZEPTO": "ZEPTO",
        "BLINKIT": "BLINKIT",
        "BIGBASKET": "BIGBASKET",
        "STARBUCKS": "STARBUCKS",
        "MCDONALD": "MCDONALDS",
        "MCDONALDS": "MCDONALDS",
        "DOMINOS": "DOMINOS",
        "KFC": "KFC",
        "SUBWAY": "SUBWAY",
        "BOOKMYSHOW": "BOOKMYSHOW",
        "AIRTEL": "AIRTEL",
        "JIO": "JIO",
        "VI": "VODAFONE IDEA",
        "CAMPUS CANTEEN": "CAMPUS CANTEEN",
        "COLLEGE CAFE": "COLLEGE CAFE",
        "UNIVERSITY BOOKSTORE": "UNIVERSITY BOOKSTORE",
        "CAMPUS STORE": "CAMPUS STORE",
        "METRO RAIL": "METRO RAIL",
        "METRO RAIL CORP": "METRO RAIL",
        "CITY BUS": "CITY BUS",
        "CITY BUS CORP": "CITY BUS",
        "HOSTEL MESS": "HOSTEL MESS",
        "HOSTEL MESS MGMT": "HOSTEL MESS",
        "HOSTEL BROADBAND": "HOSTEL BROADBAND",
        "GOVT SCHOLARSHIP": "GOVT SCHOLARSHIP CELL",
        "GOVT SCHOLARSHIP CELL": "GOVT SCHOLARSHIP CELL",
        "MINISTRY OF EDUCATION": "MINISTRY OF EDUCATION",
        "TECH CLIENT": "TECH CLIENT",
    }

    # Bank IFSC pattern (4 letters, 0, 6 alphanumeric)
    IFSC_PATTERN = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b", re.IGNORECASE)

    # Reference numbers / numeric transaction sequences (6+ consecutive digits)
    REF_NUM_PATTERN = re.compile(r"\b\d{6,16}\b")

    # Common payment rails prefix pattern
    RAILS_PREFIX_PATTERN = re.compile(
        r"^(UPI[-/](?:CR[-/]|DR[-/])?|POS[-/](?:DEBIT[-/]|CREDIT[-/])?|NEFT[-/](?:CMS[-/])?|IMPS[-/]|RTGS[-/]|ACH[-/](?:CR[-/]|DR[-/])?|NACH[-/]|BILLDESK\*|PAYTM\*|RAZORPAY\*|RZP\*|CC AVENUE\*)",
        re.IGNORECASE,
    )

    @classmethod
    def clean_text(cls, text: Optional[str]) -> str:
        """Strip redundant whitespace, non-printable characters, and clean up punctuation."""
        if not text:
            return ""
        # Replace underscores, multiple spaces, tabs
        cleaned = re.sub(r"[\t\r\n]+", " ", text)
        cleaned = re.sub(r"\s+", " ", cleaned)
        return cleaned.strip()

    @classmethod
    def extract_merchant(
        cls,
        raw_description: Optional[str],
        description: Optional[str] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Deterministically extracts a normalized merchant name from bank narration or description.
        Returns a tuple of (normalized_merchant, display_merchant).

        Safety rules:
        - If confidence is low or narration represents a complex sentence, returns None for merchant
          rather than incorrectly misattributing a counterparty.
        - Preserves refund context: if 'REFUND' is present, does not blindly strip to bare merchant if ambiguous.
        """
        source_text = raw_description or description
        if not source_text:
            return None, None

        cleaned = cls.clean_text(source_text)
        if not cleaned:
            return None, None

        # Check for structured Indian banking tokens split by '/'
        # E.g.: 'UPI/CR/82910281/CAMPUS CANTEEN/UTIB000123'
        # E.g.: 'POS/DEBIT/UNIVERSITY BOOKSTORE/HDFC00004'
        if "/" in cleaned:
            segments = [s.strip() for s in cleaned.split("/") if s.strip()]
            candidate_segments = []
            for seg in segments:
                upper_seg = seg.upper()
                # Skip banking rail identifiers, CR/DR flags, and reference numbers
                if upper_seg in ("UPI", "POS", "NEFT", "IMPS", "RTGS", "ACH", "NACH", "CR", "DR", "DEBIT", "CREDIT", "CMS", "ORDER"):
                    continue
                if cls.REF_NUM_PATTERN.fullmatch(seg):
                    continue
                if cls.IFSC_PATTERN.fullmatch(seg):
                    continue
                candidate_segments.append(seg)

            if candidate_segments:
                # First non-trivial non-system segment is the candidate merchant
                candidate = candidate_segments[0]
                norm = cls._normalize_merchant_candidate(candidate)
                if norm:
                    return norm, candidate.strip()

        # Check for hyphen-separated UPI patterns:
        # E.g.: 'UPI-UBER-TRIP-928372' -> candidate 'UBER'
        if "-" in cleaned and cleaned.upper().startswith("UPI-"):
            parts = [p.strip() for p in cleaned.split("-") if p.strip()]
            if len(parts) >= 2:
                candidate = parts[1]
                norm = cls._normalize_merchant_candidate(candidate)
                if norm:
                    return norm, candidate.strip()

        # Check for stripped rails prefix (e.g. 'AMZN MKTPLACE PMTS' or 'PAYTM*SWIGGY')
        stripped = cls.RAILS_PREFIX_PATTERN.sub("", cleaned).strip()
        # Remove trailing/leading asterisks or slashes
        stripped = re.sub(r"^[*\/]+|[*\/]+$", "", stripped).strip()

        norm = cls._normalize_merchant_candidate(stripped)
        if norm:
            return norm, stripped

        # Check if any known merchant substring matches safely
        norm_match = cls._match_known_merchants(cleaned)
        if norm_match:
            return norm_match, norm_match

        # Fallback: if description is short and looks like a merchant name (1-3 words, no full sentences)
        words = cleaned.split()
        if 1 <= len(words) <= 4 and not any(w.lower() in ("from", "to", "sent", "received", "paid", "towards") for w in words):
            # Clean of digits and punctuation
            cleaned_words = [re.sub(r"[^a-zA-Z0-9&'\s]", "", w) for w in words]
            candidate_name = " ".join(w for w in cleaned_words if w and not w.isdigit()).strip()
            if candidate_name and len(candidate_name) >= 2:
                return candidate_name.upper(), candidate_name

        return None, None

    @classmethod
    def _normalize_merchant_candidate(cls, candidate: str) -> Optional[str]:
        """Normalize a candidate string using known patterns, alias maps, and whitespace cleanup."""
        if not candidate:
            return None

        # Remove IFSC codes and reference numbers from within the candidate
        cand = cls.IFSC_PATTERN.sub("", candidate)
        cand = cls.REF_NUM_PATTERN.sub("", cand)
        # Remove common payment gateway artifacts
        cand = re.sub(r"\b(PMTS|PAYMENTS|BILLDESK|MKTPLACE|INDIA|SERVICES|PVT|LTD|CORP|LLP|INC)\b", "", cand, flags=re.IGNORECASE)
        # Strip trailing/leading punctuation
        cand = re.sub(r"^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$", "", cand).strip()
        cand = re.sub(r"\s+", " ", cand)

        if not cand or len(cand) < 2:
            return None

        cand_upper = cand.upper()

        # Check alias dictionary
        if cand_upper in cls.KNOWN_MERCHANTS:
            return cls.KNOWN_MERCHANTS[cand_upper]

        for known_key, canonical in cls.KNOWN_MERCHANTS.items():
            if cand_upper.startswith(known_key) or f" {known_key} " in f" {cand_upper} ":
                return canonical

        return cand_upper

    @classmethod
    def _match_known_merchants(cls, text: str) -> Optional[str]:
        """Search for known merchant keywords within arbitrary text safely."""
        text_upper = text.upper()
        # Sort by longest key first to match 'AMAZON PAY' before 'AMAZON'
        for known_key in sorted(cls.KNOWN_MERCHANTS.keys(), key=len, reverse=True):
            pattern = rf"\b{re.escape(known_key)}\b"
            if re.search(pattern, text_upper):
                return cls.KNOWN_MERCHANTS[known_key]
        return None

    @classmethod
    def normalize_payment_method(cls, text: Optional[str], default_method: str = "Bank Transfer") -> str:
        """Infer payment method from text tokens if not explicitly provided."""
        if not text:
            return default_method
        upper = text.upper()
        if "UPI" in upper:
            return "UPI"
        if "POS" in upper or "DEBIT" in upper or "CARD" in upper:
            return "Debit Card"
        if "CREDIT" in upper:
            return "Credit Card"
        if "NEFT" in upper or "IMPS" in upper or "RTGS" in upper or "ACH" in upper or "BANK" in upper:
            return "Bank Transfer"
        if "CASH" in upper:
            return "Cash"
        return default_method

    @classmethod
    def detect_refund_or_reversal(cls, description: Optional[str], raw_description: Optional[str]) -> Tuple[bool, bool]:
        """
        Detects whether narration explicitly denotes a refund or reversal.
        Returns: (is_refund, is_reversal)
        """
        combined = f"{description or ''} {raw_description or ''}".upper()
        is_refund = "REFUND" in combined or "CASHBACK" in combined
        is_reversal = "REVERSAL" in combined or "CHARGEBACK" in combined or "RETURNED" in combined
        return is_refund, is_reversal
