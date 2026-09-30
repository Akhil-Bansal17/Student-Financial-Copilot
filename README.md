# Student Financial Copilot 🎓💰

A modern, student-focused personal finance web application and Progressive Web App (PWA) designed to give students instant clarity over their money, spending habits, savings goals, and upcoming financial commitments.

---

## 🌟 Product Vision

Student life moves quickly. Between hostel rent, campus canteen meals, metro fares, textbooks, and weekend hangouts, tracking expenses shouldn't require an accounting degree or spreadsheet gymnastics.

**Student Financial Copilot** is designed from the ground up to be:
- **Mobile-First**: Optimized for phones (320px–430px) as an installable PWA with ergonomic thumb navigation.
- **Fast & Intuitive**: Understand your primary financial state in under 3 seconds with the **"Safe to spend"** daily index.
- **Deterministic & Trustworthy**: All account totals, savings metrics, and budgets are calculated by verified domain algorithms. AI serves as an evidence-based advisor, never the calculator.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui design primitives
- **Icons**: Lucide React
- **Routing**: React Router v7
- **Server State**: TanStack Query v5
- **Forms & Validation**: React Hook Form + Zod
- **Client State**: Zustand
- **Analytics Visuals**: Recharts
- **PWA**: Web App Manifest, mobile viewport & standalone display configuration
- **Testing**: Vitest + React Testing Library + jsdom

### Backend
- **Framework**: Python 3.14 + FastAPI
- **Validation**: Pydantic v2 + Pydantic Settings
- **ORM & Database**: SQLAlchemy 2.0 + PostgreSQL 16 + psycopg2-binary
- **Database Migrations**: Alembic
- **Testing**: Pytest + HTTPX

### Infrastructure & Tooling
- **Containerization**: Docker & Docker Compose
- **Environment**: Strict `.env` configuration with `.env.example`
- **Architecture**: Modular monorepo with clean service boundaries

---

## 📁 Repository Structure

```
student-financial-copilot/
├── frontend/                        # React + TS + Vite web app & PWA
│   ├── public/                      # Static assets, icons, manifest.json
│   ├── src/
│   │   ├── components/              # Design system primitives & states
│   │   ├── layouts/                 # AppLayout (mobile bottom nav + desktop sidebar)
│   │   ├── pages/                   # Feature routes (Dashboard, Activity, Insights, Goals, etc.)
│   │   ├── services/                # API client abstraction & health check hooks
│   │   ├── routes/                  # Route definitions
│   │   ├── hooks/                   # Custom application hooks
│   │   ├── types/                   # Shared TypeScript models
│   │   └── lib/                     # Query client & CSS utilities
│   ├── tests/                       # Vitest component & navigation tests
│   └── vite.config.ts
├── backend/                         # FastAPI application
│   ├── app/
│   │   ├── api/v1/                  # Versioned API routes & health check
│   │   ├── core/                    # Config, error handling, security
│   │   ├── db/                      # Sessionmaker & Base metadata
│   │   ├── models/                  # SQLAlchemy models (User foundation)
│   │   ├── schemas/                 # Pydantic validation models
│   │   └── main.py                  # ASGI application entrypoint
│   ├── alembic/                     # Database migrations
│   ├── tests/                       # Pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
├── docs/                            # Deep-dive architecture & vision
│   ├── architecture.md
│   └── product-vision.md
├── scripts/                         # Automation & developer scripts
├── docker-compose.yml               # PostgreSQL + Backend + Frontend stack
├── .env.example                     # Environment template
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20+ (v24 recommended) & npm
- **Python**: 3.12+ (3.14 supported)
- **Docker & Docker Compose** (optional for containerized PostgreSQL)

---

### 1. Environment Setup

Copy `.env.example` to `.env` in the root:
```bash
cp .env.example .env
```

---

### 2. Backend Setup & Local Run

```bash
# Navigate to backend directory
cd backend

# (Optional) Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run FastAPI backend server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be live at `http://127.0.0.1:8000`:
- **Health Check**: `GET http://127.0.0.1:8000/api/v1/health`
- **Interactive OpenAPI Docs**: `http://127.0.0.1:8000/docs`

---

### 3. Frontend Setup & Local Run

```bash
# In a new terminal, navigate to frontend
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The frontend will be live at `http://localhost:5173`.

---

### 4. Running with Docker Compose

To launch the full stack (PostgreSQL database, FastAPI backend, and Vite frontend):

```bash
docker compose up --build
```

Services exposed:
- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`
- **PostgreSQL**: `localhost:5432`

---

## 🧪 Testing

### Backend Tests
```bash
# From repository root:
# Windows PowerShell:
$env:PYTHONPATH="backend"; python -m pytest backend/tests

# Linux / macOS:
PYTHONPATH=backend pytest backend/tests
```

### Frontend Tests & Type Checking
```bash
# Run Vitest test suite
cd frontend
npm run test -- --run

# Run TypeScript compilation and build check
npm run build
```

---

## 🧭 Application Routes

| Route | Purpose | Navigation |
|---|---|---|
| `/` | Dashboard with "Safe to spend" hero card, balance row, recent transactions, insights, upcoming bills | Bottom Nav (Home) / Desktop Sidebar |
| `/activity` | Transaction history, advanced filters, search, bulk updates & transaction detail sheet | Bottom Nav (Activity) / Desktop Sidebar |
| `/copilot` | Evidence-based AI Copilot advisor with contextual insight chips and bank balance awareness | Bottom Nav (Copilot) / Desktop Sidebar |
| `/insights` | Spending analytics, monthly trends, breakdown charts & high-priority financial observations | Bottom Nav (Insights) / Desktop Sidebar |
| `/budgets` | Student monthly category budgets with live spend tracking & safe daily allowance calculations | Desktop Sidebar / Quick Links |
| `/goals` | Savings targets, progress tracking, milestone forecasts & contribution simulation | Bottom Nav (Goals) / Desktop Sidebar |
| `/connected-accounts` | Bank account aggregator sandbox, Setu provider adapter, consent flow & real-time sync | Desktop Sidebar / Settings |
| `/more` | Profile summary, financial health score, settings, currency preferences & sign out | Bottom Nav (More) / Desktop Sidebar |
| `/login` | JWT authentication & user login | Auth flow |
| `/register` | New student account registration | Auth flow |
| `/onboarding` | 3-step student profile onboarding (academics, funding sources, financial focus) | First-run flow |

---

## 🗺 Roadmap & Implemented Phases

- [x] **Phase 1: Architecture & Mobile-First Foundation**
  - Monorepo structure, Tailwind CSS + shadcn/ui primitives, responsive shell (bottom nav + desktop sidebar), PWA manifest, FastAPI health endpoint, SQLAlchemy & Alembic scaffolding, Docker compose.
- [x] **Phase 2: Authentication & User Profiles**
  - JWT auth with Argon2id password hashing, session tokens, protected API routes, registration, login, and user profile management.
- [x] **Phase 3: Financial Core, Ledger & Transactions**
  - Robust transaction store, deterministic balance aggregations, category classification, manual transaction creation, and multi-month activity filters.
- [x] **Phase 4: Student Budgeting & "Safe-to-Spend" Engine**
  - Category budget tracking, expense velocity indicators, and daily safe-to-spend allowance calculations accounting for fixed commitments.
- [x] **Phase 5: Savings Goals & Forecasting**
  - Milestone targets, target completion date estimates, emergency fund tracking, and visual progress indicators.
- [x] **Phase 6: Advanced Financial Insights**
  - Heuristic spending anomaly detection, recurring expense tracking, discretionary vs. non-discretionary categorization, and actionable tip cards.
- [x] **Phase 7: Evidence-Based AI Copilot**
  - Observational LLM layer grounding responses on verified ledger figures, suggested question chips, and multi-turn financial guidance.
- [x] **Phase 8: Student Onboarding Flow**
  - Interactive multi-step setup collecting academic status, funding sources (pocket money, part-time, scholarship, allowance), and savings priorities.
- [x] **Phase 9: Account Aggregator Sandbox & Bank Sync Core**
  - Setu Account Aggregator adapter, secure HMAC state tokens for consent redirects, deterministic mock bank data provider, and bank synchronization service with deduplication.
- [x] **Phase 10: Automatic Bank Sync & Financial Reconciliation**
  - In-process background sync scheduler, distributed concurrency locking, incremental cursors, bounded retries, and deterministic transaction reconciliation engine.
- [x] **Phase 11: Transaction Intelligence & Merchant Normalization**
  - Deterministic merchant extraction rules, user custom merchant preferences, bulk transaction category updates, slide-over TransactionDetailSheet, and drawer search/filtering.
