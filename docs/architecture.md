# System Architecture: Student Financial Copilot

## 1. Architectural Philosophy

Student Financial Copilot is designed with a **clean modular architecture**, prioritizing:
- **Mobile-first accessibility**: Primary user touchpoint is a mobile viewport (320px–430px) as a high-performance web app / installable PWA, scaling gracefully to desktop.
- **Deterministic financial core**: Financial balances, transaction aggregation, budgets, and savings calculations are computed **strictly by deterministic domain logic**, never by non-deterministic language models.
- **Explainability & AI layer**: Future AI and LLM agents operate purely in an observational and advisory capacity, consuming verified backend outputs to produce natural-language explanations and personalized nudges.
- **Modular monorepo**: Clear separation of concerns between frontend client layers, backend API/domain layers, persistence migrations, and cross-cutting infrastructure.

---

## 2. Monorepo Structure

```
student-financial-copilot/
│
├── frontend/                        # React + TypeScript + Vite + Tailwind CSS
│   ├── public/                      # PWA manifest, service worker icons, favicon
│   ├── src/
│   │   ├── components/              # UI design system & common components
│   │   │   ├── ui/                  # Accessible primitives (Button, Card, Badge, etc.)
│   │   │   ├── layout/              # BottomNav, DesktopSidebar, TopHeader
│   │   │   └── common/              # State handlers (Loading, Error, Empty, HealthBadge)
│   │   ├── layouts/                 # Root AppLayout, AuthLayout
│   │   ├── pages/                   # Feature page routes (Dashboard, Activity, Insights, etc.)
│   │   ├── routes/                  # React Router configuration
│   │   ├── hooks/                   # Custom business & UI hooks
│   │   ├── services/                # API clients, HTTP wrappers, health queries
│   │   ├── stores/                  # Lightweight client state (Zustand)
│   │   ├── schemas/                 # Zod validation schemas
│   │   ├── types/                   # Shared TypeScript models & DTOs
│   │   ├── lib/                     # Utilities (cn, formatters, queryClient)
│   │   └── assets/                  # Static assets and icons
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend/                         # FastAPI + SQLAlchemy + Pydantic + Alembic
│   ├── app/
│   │   ├── api/                     # API routers and dependency injection
│   │   │   ├── v1/                  # Versioned API routes (v1)
│   │   │   │   ├── endpoints/       # Route controllers (health, etc.)
│   │   │   │   └── router.py
│   │   │   └── deps.py              # Common request dependencies
│   │   ├── core/                    # App configuration, security, error handling
│   │   ├── db/                      # Database engine, sessionmaker, declarative Base
│   │   ├── models/                  # SQLAlchemy ORM models (User foundation)
│   │   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── services/                # Business services (future calculations)
│   │   ├── domain/                  # Pure deterministic financial models
│   │   └── main.py                  # ASGI entrypoint & middleware setup
│   ├── alembic/                     # Database migrations
│   ├── tests/                       # Pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
│
├── docs/                            # Architectural and product documentation
│   ├── architecture.md
│   └── product-vision.md
│
├── scripts/                         # Local developer automation scripts
│
├── docker-compose.yml               # Multi-service container definitions
├── .env.example                     # Environment template
├── .gitignore
└── README.md
```

---

## 3. High-Level System Flow

```
┌─────────────────────────────────────────────────────────┐
│                      Client Layer                       │
│  Mobile Browser / PWA  <─────────>  Desktop Browser     │
│  (React 19 + Vite + Tailwind + TanStack Query + Router) │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS / REST (JSON)
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Backend API Gateway                   │
│         FastAPI (CORS, Error Handlers, Validation)      │
└─────────────┬─────────────────────────────┬─────────────┘
              │                             │
              ▼                             ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│     Domain Services       │ │     Persistence Layer     │
│  - Financial Calculations │ │  - PostgreSQL 16          │
│  - Analytics Engine       │ │  - SQLAlchemy 2.0 ORM     │
│  - Budgeting & Goals      │ │  - Alembic Migrations     │
└─────────────┬─────────────┘ └───────────────────────────┘
              │ (Verified Domain Metrics)
              ▼
┌─────────────────────────────────────────────────────────┐
│             Future Insight & Copilot Pipeline           │
│  Deterministic Insights  ───>  AI Explanations & Advice │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Future Financial Intelligence Pipeline

The system is architected to scale along a strict unidirectional data flow:

1. **User / Ingestion**: Bank/UPI statement records, manual entries, or recurring rules ingested through validated schemas.
2. **Transactions**: Cleaned, categorized, normalized transactions stored in PostgreSQL with strict ledger integrity.
3. **Financial Calculations (Deterministic Core)**:
   - Account balances (`sum(inflows) - sum(outflows)`)
   - "Safe to spend" daily / weekly allowances based on fixed student commitments (hostel, fees, recurring subscriptions)
   - Month-to-date category burn rates
4. **Analytics**: Window aggregations, spending velocity, peer category benchmarking.
5. **Budgeting & Goals**: Goal trajectory formulas, deficit warnings, auto-allocation simulations.
6. **Insight Engine**: Deterministic trigger rules (e.g., *"Food spending 25% above 30-day baseline"*).
7. **AI Explanation & Copilot**: Prompt templates synthesizing verified numbers into empathetic, actionable student advice.

---

## 5. Security & Reliability Foundations

- **Centralized Error Handling**: Unhandled exceptions are logged internally and surfaced to clients as structured error payloads (`{ error: { code, message, details } }`).
- **Secret Isolation**: Configuration loaded via `pydantic-settings` from environment variables, strictly excluded from version control.
- **Cross-Origin Resource Sharing**: Strict CORS origin whitelisting configured in `core/config.py`.
- **Database Connection Pooling**: SQLAlchemy connection pool with ping validation (`pool_pre_ping=True`) to gracefully recover from dropped connections.
