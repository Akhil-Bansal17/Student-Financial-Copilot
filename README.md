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

## 🧭 Initial Routes

| Route | Purpose | Navigation |
|---|---|---|
| `/` | Dashboard with "Safe to spend" hero card, balance row, recent transactions, insights, upcoming bills | Bottom Nav (Home) / Desktop Sidebar |
| `/activity` | Transaction history & category filters | Bottom Nav (Activity) / Desktop Sidebar |
| `/insights` | Spending analytics & trends | Bottom Nav (Insights) / Desktop Sidebar |
| `/goals` | Savings targets & progress | Bottom Nav (Goals) / Desktop Sidebar |
| `/more` | Profile, settings, currency preferences | Bottom Nav (More) / Desktop Sidebar |
| `/login` | Authentication placeholder | Auth flow |
| `/register` | Registration placeholder | Auth flow |
| `/onboarding` | Student profile onboarding placeholder | First-run flow |

---

## 🗺 Roadmap

- [x] **Phase 1: Architecture & Mobile-First Foundation** *(Current Phase)*
  - Monorepo structure, design system, responsive shell (bottom nav + desktop sidebar), PWA manifest, FastAPI health endpoint, SQLAlchemy & Alembic scaffolding, Docker compose, test suites.
- [ ] **Phase 2: Authentication & User Profiles**
  - JWT auth, session management, college/semester profile attributes.
- [ ] **Phase 3: Financial Core & Ledger**
  - Strict double-entry transaction store, deterministic balance aggregations, category management.
- [ ] **Phase 4: Student Budgeting & "Safe-to-Spend" Algorithm**
  - Dynamic daily allowance calculations factoring in fixed student expenses (hostel/fees/bills).
- [ ] **Phase 5: Savings Goals & Forecasting**
  - Emergency funds, gadget/travel targets, compound savings simulations.
- [ ] **Phase 6: Evidence-Based AI Copilot**
  - Observational LLM layer explaining verified domain numbers and generating student recommendations.
