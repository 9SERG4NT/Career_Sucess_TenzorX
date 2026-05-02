<p align="center">
  <img src="https://img.shields.io/badge/Poonawalla_Fincorp-PlacementIQ-1B2C5E?style=for-the-badge&labelColor=1E56C7&logoColor=white" alt="PlacementIQ" />
  <img src="https://img.shields.io/badge/version-2.0.0-1E56C7?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
</p>

# PlacementIQ v2.0 — Agentic AI Career Risk Intelligence Platform

> **A Poonawalla Fincorp initiative** — AI-powered education loan placement risk prediction for lenders, built on a Multi-Agent architecture with real-time market intelligence.

---

## 📌 Overview

**PlacementIQ** is an intelligent risk assessment platform designed for education loan portfolios. It predicts whether a borrower (student) will secure employment within 3/6/12 months of graduation, enabling proactive intervention before loan defaults occur.

The platform uses a **hybrid AI architecture**:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **ML Scoring Engine** | XGBoost + LightGBM | Fast, deterministic base risk scores (~50ms) |
| **SHAP Explainability** | TreeExplainer | Feature-level contribution to each score |
| **Multi-Agent AI System** | LLM Orchestrator (5 agents) | Deep contextual reasoning & intervention planning |
| **Real Market Data** | World Bank + India job portals | Live demand signals, macro-climate index |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                 │
│  Dashboard │ Portfolio │ Heatmap │ Reports │ AI Agents   │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (JSON)
┌──────────────────────▼──────────────────────────────────┐
│                 FastAPI Backend (:8001)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Scoring     │  │  Agent       │  │  Real Data    │  │
│  │  Engine      │  │  Orchestrator│  │  Fetcher      │  │
│  │  (XGB+LGBM)  │  │  (5 agents)  │  │  (WorldBank)  │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  SHAP        │  │  Tool        │  │  Data         │  │
│  │  Explainer   │  │  Registry    │  │  Generator    │  │
│  └──────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🤖 The AI Agents

Five specialized LLM-powered agents replace formerly static/hardcoded systems:

| # | Agent | Replaces | Purpose |
|---|-------|----------|---------|
| 1 | **NBA Agent** | Static rule tables | Recommends highest-ROI interventions using SHAP drivers + EMI data |
| 2 | **Explainability Agent** | Hardcoded NLG templates | Translates ML outputs into human-readable risk narratives |
| 3 | **Market Intelligence Agent** | Static WoW thresholds | Detects placement shocks from live labor market signals |
| 4 | **Career Path Agent** | Static adjacency maps | Recommends career pivots weighted by regional demand |
| 5 | **Offer Survival Agent** | Secondary classifiers | Scores probability of offer revocation using company health signals |

### Multi-Provider LLM Support

Switch between providers with a single `.env` variable:

| Provider | Model | Best For |
|----------|-------|----------|
| **Groq** | `llama-3.3-70b-versatile` | Fastest inference |
| **Anthropic** | `claude-sonnet-3.5` | Best tool use |
| **OpenRouter** | Aggregator (Claude/Llama/Gemini) | Flexibility |
| **OpenAI** | `gpt-4o` | General purpose |

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.10+ | Runtime |
| FastAPI | Latest | REST API framework |
| XGBoost | Latest | Classification model |
| LightGBM | Latest | Salary regression model |
| SHAP | Latest | Model explainability |
| LiteLLM | ≥1.50 | Multi-provider LLM abstraction |
| Pandas / NumPy | Latest | Data processing |
| Uvicorn | Latest | ASGI server |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| Vite | 8 | Build tool & dev server |
| React Router | 7 | Client-side routing |
| Recharts | 3 | Data visualization |
| Lucide React | Latest | Icon system |
| Axios | Latest | HTTP client |

### Design System
- **Brand**: Poonawalla Fincorp corporate identity
- **Primary Colors**: Navy `#1B2C5E`, Corporate Blue `#1E56C7`
- **Typography**: Lato + Inter
- **Themes**: Dark mode (default) + Light mode toggle

---

## 📁 Project Structure

```
PlacementIQ/
├── README.md
├── PlacementIQ_PRD_v2.md              # Product Requirements Document
├── PLACEMENTIQ_AGENTIC_IMPLEMENTATION.md
│
├── backend/
│   ├── main.py                        # FastAPI app — 32 endpoints
│   ├── scoring_engine.py              # XGBoost + LightGBM + SHAP pipeline
│   ├── model_pipeline.py              # Model training & persistence
│   ├── data_generator.py              # Synthetic student data (10K records)
│   ├── real_data_fetcher.py           # World Bank + India market data
│   ├── config.py                      # Environment & provider configuration
│   ├── requirements.txt               # Python dependencies
│   ├── .env                           # API keys (not committed)
│   ├── agents/
│   │   ├── orchestrator.py            # Agent orchestration & parallelization
│   │   ├── provider.py                # Multi-LLM provider abstraction
│   │   ├── base_agent.py              # Base agent class (tool calling)
│   │   ├── tools.py                   # Tool registry with caching layer
│   │   ├── nba_agent.py               # Next-Best-Action recommendations
│   │   ├── explainability_agent.py    # Human-readable risk narratives
│   │   ├── market_agent.py            # Placement shock detection
│   │   ├── career_path_agent.py       # Career pivot recommendations
│   │   └── offer_survival_agent.py    # Offer revocation probability
│   ├── data/
│   │   ├── synthetic_students.csv     # Generated student dataset
│   │   └── market_data.json           # Cached market intelligence
│   └── models/
│       └── (trained model artifacts)
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── main.jsx                   # App entry point
│       ├── App.jsx                    # Layout, sidebar, routing
│       ├── App.css                    # Theme-specific glassmorphism
│       ├── index.css                  # Design system tokens (800+ lines)
│       ├── components/
│       │   └── Background3D.jsx       # Animated 3D background
│       ├── context/
│       │   └── ThemeContext.jsx        # Dark/Light theme provider
│       └── pages/
│           ├── Dashboard.jsx          # Portfolio overview + risk cards
│           ├── StudentProfile.jsx     # Individual student deep dive
│           ├── Heatmap.jsx            # Field × Region demand grid
│           ├── Reports.jsx            # Drift monitoring + audit
│           ├── Institutes.jsx         # Institute benchmarking
│           ├── AgenticInsights.jsx    # AI agent activity viewer
│           └── Admin.jsx              # Settings + configuration
└── .gitignore
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Minimum Version |
|------------|----------------|
| **Python** | 3.10+ |
| **Node.js** | 18+ |
| **npm** | 9+ |
| **Git** | Any |

### Step 1 — Clone the Repository

```bash
git clone https://github.com/your-org/PlacementIQ.git
cd PlacementIQ
```

### Step 2 — Backend Setup

```bash
# Navigate to backend
cd backend

# Create & activate virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 3 — Configure Environment

Create a `.env` file in the `backend/` directory:

```env
# Choose your LLM provider: groq | anthropic | openrouter | openai
PROVIDER=groq

# Add your API key for the chosen provider
GROQ_API_KEY=gsk_your_key_here
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# OPENROUTER_API_KEY=sk-or-...
```

> **Note:** An LLM API key is only required for the agentic features (NBA, Explainability, Career Paths, Offer Survival). The core ML scoring, heatmap, shock detection, and all dashboard features work without any API key.

### Step 4 — Generate Synthetic Data

```bash
# Still in the backend/ directory
python data_generator.py
```

This generates `data/synthetic_students.csv` with 10,000 student records.

### Step 5 — Start the Backend

```bash
python main.py
```

The API server starts on **http://localhost:8001**. Verify with:

```bash
curl http://localhost:8001/health
# → {"status":"ok","students_loaded":10000}
```

### Step 6 — Frontend Setup

Open a **new terminal**:

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend starts on **http://localhost:5173**. Open it in your browser.

---

## ✅ Quick Verification Checklist

After setup, verify these work:

| Check | URL / Action | Expected |
|-------|-------------|----------|
| Backend health | `GET http://localhost:8001/health` | `{"status":"ok"}` |
| Dashboard loads | Open `http://localhost:5173` | Portfolio overview with risk cards |
| Student data | `GET http://localhost:8001/api/v1/students?limit=5` | JSON array of 5 students |
| Heatmap data | `GET http://localhost:8001/api/v1/heatmap/demand` | 18-cell demand grid |
| Theme toggle | Click sun/moon icon in sidebar | Switches dark ↔ light mode |

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/score/student` | Full agentic scoring (ML + AI agents) |
| `POST` | `/api/v1/score/student/fast` | ML-only scoring (~50ms) |
| `POST` | `/api/v1/score/batch` | Batch scoring (up to 1,000 students) |
| `GET` | `/api/v1/students?limit=N` | List students from portfolio |
| `GET` | `/api/v1/student/{id}` | Full scored profile for a student |
| `GET` | `/api/v1/cohort/summary` | Portfolio-level aggregates |

### AI Agent Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/student/{id}/career-paths` | Career pivot recommendations |
| `GET` | `/api/v1/student/{id}/offer-survival?company=X` | Offer revocation probability |
| `GET` | `/api/v1/shocks/active` | Active placement shocks (real data) |

### Monitoring & Compliance

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/model/drift` | PSI drift monitoring |
| `GET` | `/api/v1/model/metadata` | Model version & metrics |
| `GET` | `/api/v1/student/{id}/history` | 90-day score history |
| `GET` | `/api/v1/student/{id}/audit-report` | Compliance audit report |
| `GET` | `/api/v1/alerts/active` | Early alert engine |
| `GET` | `/api/v1/heatmap/demand` | Employability heatmap |
| `GET` | `/api/v1/cohort/velocity` | Peer placement velocity |
| `POST` | `/api/v1/feedback` | Outcome submission (retraining loop) |
| `POST` | `/api/v1/institute/cold-start` | New institute scoring |

---

## 📊 Frontend Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Portfolio KPIs, risk distribution, watchlist, top alerts |
| **Portfolio** | `/students` | Student search, filters, individual risk cards |
| **Student Profile** | `/student/:id` | Deep dive: SHAP, NBA, score history, simulations |
| **Heatmap** | `/heatmap` | Field × Region demand grid with trend indicators |
| **Reports & Drift** | `/reports` | PSI drift, feature stability, audit export |
| **Institutes** | `/institutes` | Institute benchmarking, cold-start scoring |
| **AI Agents** | `/agentic` | Agent activity viewer, orchestration flow |
| **Admin Panel** | `/admin` | Model config, provider settings, data management |

---

## 🔐 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PROVIDER` | Optional | LLM provider: `groq`, `anthropic`, `openrouter`, `openai` |
| `GROQ_API_KEY` | If using Groq | Groq API key |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `OPENROUTER_API_KEY` | If using OpenRouter | OpenRouter API key |

---

## 📈 Model Performance

| Metric | Value |
|--------|-------|
| Classification F1 (6-month) | 0.86 |
| Salary MAPE | 12.6% |
| Training records | 8,000 |
| Evaluation records | 2,000 |
| Inference latency (ML-only) | ~50ms |
| Inference latency (Full agentic) | ~3-5s |

---

## 🧩 Key Features

- **Hybrid AI**: ML models for speed + LLM agents for depth
- **Real Market Data**: World Bank macro indicators + India job portal signals
- **SHAP Explainability**: Every score comes with feature-level explanations
- **Multi-Provider LLM**: Switch between Groq, Anthropic, OpenAI, OpenRouter
- **In-Memory Caching**: Prevents LLM rate limiting during portfolio scans
- **Dark/Light Themes**: Full theme toggle with Poonawalla Fincorp branding
- **32 API Endpoints**: Comprehensive REST API for all platform capabilities
- **PSI Drift Monitoring**: Automated model stability tracking
- **Compliance-Ready**: Audit trail + exportable reports for RBI FLDG guidelines

---

<p align="center">
  <strong>PlacementIQ v2.0</strong> — Built by <strong>Team TenzorX</strong> for Poonawalla Fincorp<br/>
  <sub>Career Risk Intelligence • Agentic AI • Education Loan Analytics</sub>
</p>