# Deployment Guide & Architecture

## 1. Overview & Architecture

The **Student Financial Copilot** is architected as a decoupled, modern multi-tier application:

| Layer | Technology | Production Host | Status |
|---|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite + Tailwind CSS + PWA | **Vercel** (`https://student-financial-copilot-wheat.vercel.app`) | **DEPLOYED & VERIFIED** |
| **Backend API** | Python 3.12/3.14 + FastAPI + Pydantic v2 | **Render / Railway / Fly.io / VPS** (Containerized) | **PENDING CLOUD HOSTING** |
| **Database** | PostgreSQL 16 + SQLAlchemy 2.0 + Alembic (`f6a7b8c9d0e1`) | **Managed PostgreSQL** (Neon / Supabase / Render / AWS RDS) | **PENDING CLOUD HOSTING** |

---

## 2. Frontend on Vercel

### Live Production Details
- **Production URL**: `https://student-financial-copilot-wheat.vercel.app`
- **Vercel Project**: `akhil-bansal17s-projects/student-financial-copilot`
- **Build Command**: `npm --prefix frontend run build` (`tsc -b && vite build`)
- **Output Directory**: `frontend/dist`
- **Framework Preset**: `vite`

### Key Routing & PWA Features
1. **SPA Client-side Routing**:
   Handled via `vercel.json` rewrites (`/(.*)` -> `/index.html`), ensuring direct URLs like `/login`, `/activity`, `/budgets`, and `/goals` load smoothly without 404s.
2. **PWA Shell Caching**:
   `sw.js` and `manifest.json` are served with `Cache-Control: public, max-age=0, must-revalidate` and `Service-Worker-Allowed: /` to guarantee prompt updates.
3. **API Routing**:
   `frontend/src/services/apiClient.ts` reads `VITE_API_URL` (or `VITE_API_BASE_URL`). When set, all requests are dispatched via HTTPS directly to the deployed backend.

---

## 3. Backend Deployment Architecture & Vercel Incompatibility Analysis

Per deployment specifications, the existing FastAPI + PostgreSQL backend is **intentionally NOT forced into Vercel Serverless Functions**. The architectural reasons are:

1. **Persistent In-Process Background Scheduler**:
   - `app/services/bank_sync_scheduler.py` manages a background thread started in FastAPI's `lifespan` handler to periodically synchronize bank accounts, acquire distributed sync locks, and reconcile ledger transactions.
   - Vercel Serverless Functions immediately freeze or terminate execution threads upon HTTP response return, rendering in-process scheduled tasks and locks non-operational.
2. **PostgreSQL Socket Connection Pooling**:
   - SQLAlchemy with `psycopg2-binary` connects to PostgreSQL via stateful TCP sockets. Serverless cold starts cause connection churn and connection pool exhaustion on standard PostgreSQL without external transaction poolers.
3. **Database Hosting**:
   - Vercel is a frontend and serverless compute provider; it does not host stateful PostgreSQL databases. A dedicated managed PostgreSQL instance is required.

---

## 4. Minimum Required Backend Deployment Configuration

To deploy the backend to a container-friendly cloud platform (such as Render, Railway, or Fly.io):

### Step 1: Provision Managed PostgreSQL
Create a PostgreSQL 16 database on your preferred cloud provider (e.g., Neon, Supabase, Render PostgreSQL, or Railway Postgres). Obtain the connection string:
```
postgresql+psycopg2://<user>:<password>@<host>:<port>/<dbname>
```

### Step 2: Run Alembic Migrations
Run the migration suite to bring the database schema to head (`f6a7b8c9d0e1`):
```bash
# In backend directory with DATABASE_URL set to cloud database:
alembic upgrade head
```

### Step 3: Deploy FastAPI Container
Deploy using the included production Dockerfile (`backend/Dockerfile`):
```bash
# Build & Run command:
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 4: Configure Backend Environment Variables
Set the following environment variables on the backend cloud host:

| Variable | Recommended Production Setting | Description |
|---|---|---|
| `APP_ENV` | `production` | Enables production security mode |
| `DEBUG` | `False` | Disables public OpenAPI documentation and detailed stack traces |
| `SECRET_KEY` | *(Generate via `openssl rand -hex 32`)* | Secure secret key for JWT session signing |
| `DATABASE_URL` | `postgresql+psycopg2://...` | Cloud PostgreSQL connection string |
| `CORS_ORIGINS` | `["https://student-financial-copilot-wheat.vercel.app"]` | Allows cross-origin requests from the Vercel frontend |
| `AA_REDIRECT_URL` | `https://student-financial-copilot-wheat.vercel.app/connected-accounts` | Account Aggregator redirect URL after consent |
| `BANK_PROVIDER` | `mock_bank` (or `setu_aa`) | Bank data provider |
| `BANK_SYNC_ENABLED`| `True` | Runs automatic periodic bank sync scheduler |
| `AI_PROVIDER` | `gemini` (or `mock`) | AI Copilot engine provider |
| `AI_API_KEY` | *(Your Gemini API Key)* | API Key for Gemini 1.5 Flash |

---

## 5. Connecting Frontend to Backend on Vercel

Once the backend service is deployed (e.g. `https://api.yourdomain.com` or `https://student-copilot-api.onrender.com`):

1. **Add Environment Variable on Vercel**:
   ```bash
   npx vercel env add VITE_API_URL production
   # When prompted, enter: https://<your-backend-api-url>
   ```
   *Or navigate to Vercel Dashboard > `student-financial-copilot` > Settings > Environment Variables, and set `VITE_API_URL` to your backend URL.*

2. **Trigger Production Redeploy**:
   ```bash
   npx vercel deploy --prod
   ```

3. **Verify Connectivity**:
   - Check `GET /api/v1/health` via the frontend client.
   - Test user registration and login against the production database.
