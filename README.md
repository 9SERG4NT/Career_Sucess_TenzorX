<p align="center">
  <img src="https://img.shields.io/badge/Poonawalla_Fincorp-PlacementIQ-1B2C5E?style=for-the-badge&labelColor=1E56C7&logoColor=white" alt="PlacementIQ" />
  <img src="https://img.shields.io/badge/version-2.0.0-1E56C7?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/react-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/license-Proprietary-1B2C5E?style=for-the-badge" alt="License" />
</p>

<h1 align="center">PlacementIQ v2.0</h1>
<h3 align="center">Agentic AI Career Risk Intelligence Platform</h3>

<p align="center">
  <em>A <strong>Poonawalla Fincorp</strong> initiative — AI-powered education-loan placement risk prediction for lenders,<br/>
  built on a <strong>multi-agent architecture</strong> with real-time market intelligence.</em>
</p>

<p align="center">
  <a href="https://drive.google.com/drive/folders/1yOtAta0nSEQPCaNb2IFFw2OgZiMW4W31?usp=sharing">
    <img src="https://img.shields.io/badge/▶_Watch_Demo_Video-Google_Drive-EA4335?style=for-the-badge&logo=googledrive&logoColor=white" alt="Demo Video" />
  </a>
  &nbsp;
  <a href="#-getting-started">
    <img src="https://img.shields.io/badge/🚀_Quick_Start-Setup_Guide-1E56C7?style=for-the-badge" alt="Quick Start" />
  </a>
  &nbsp;
  <a href="#-outputs--working-prototype-screenshots">
    <img src="https://img.shields.io/badge/📸_Screenshots-Live_Prototype-10B981?style=for-the-badge" alt="Screenshots" />
  </a>
</p>

---

## 🎬 Demo & Live Preview

> **🎥 Full Demo Video** → [**Watch on Google Drive**](https://drive.google.com/drive/folders/1yOtAta0nSEQPCaNb2IFFw2OgZiMW4W31?usp=sharing)
>
> A walkthrough of the working prototype covering all 8 pages, the 5 AI agents, real-time market intelligence, drift monitoring, and the cold-start scoring engine.

| Surface | URL (when running locally) |
|---|---|
| 🌐 **Frontend (React)** | [http://localhost:5173](http://localhost:5173) |
| ⚡ **Backend API (FastAPI)** | [http://localhost:8001](http://localhost:8001) |
| 📚 **Interactive API Docs (Swagger)** | [http://localhost:8001/docs](http://localhost:8001/docs) |

---

## 📑 Table of Contents

1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [Architecture](#-architecture)
4. [The AI Agent System](#-the-ai-agent-system)
5. [Tech Stack](#-tech-stack)
6. [Getting Started](#-getting-started)
7. [Quick Verification](#-quick-verification)
8. [Outputs — Working Prototype Screenshots](#-outputs--working-prototype-screenshots)
9. [API Reference](#-api-reference)
10. [Frontend Pages](#-frontend-pages)
11. [Configuration](#-configuration)
12. [Model Performance](#-model-performance)
13. [Project Structure](#-project-structure)

---

## 📌 Overview

**PlacementIQ** is an intelligent risk-assessment platform purpose-built for **education-loan portfolios**. It predicts whether a borrower (student) will secure employment within **3 / 6 / 12 months** of graduation — enabling **proactive intervention** before loan defaults occur.

The platform combines **deterministic ML models** for speed with **LLM-powered agents** for contextual depth, all grounded in **live market data** from public APIs.

| Layer | Technology | Purpose |
|---|---|---|
| 🧮 **ML Scoring Engine** | XGBoost + LightGBM | Fast, deterministic base risk scores (~50ms) |
| 🔍 **SHAP Explainability** | TreeExplainer | Feature-level contribution to each score |
| 🤖 **Multi-Agent AI System** | LLM Orchestrator (5 agents) | Deep contextual reasoning & intervention planning |
| 🌍 **Real Market Data** | World Bank + India job portals | Live demand signals, macro-climate index |

---

## 🧩 Key Features

- ✅ **Hybrid AI** — ML models for speed + LLM agents for depth
- 🌐 **Real Market Data** — World Bank macro indicators + India job-portal signals
- 🔬 **SHAP Explainability** — Every score includes feature-level explanations
- 🔄 **Multi-Provider LLM** — Switch between Groq, Anthropic, OpenAI, OpenRouter via `.env`
- ⚡ **In-Memory Caching** — Prevents LLM rate limiting during portfolio scans
- 🌓 **Dark / Light Themes** — Full theme toggle with Poonawalla Fincorp branding
- 📡 **32 API Endpoints** — Comprehensive REST API for all platform capabilities
- 📊 **PSI Drift Monitoring** — Automated model-stability tracking
- 📑 **Compliance-Ready** — Audit trail + exportable reports for RBI FLDG guidelines
- 🧪 **Cold-Start Scoring** — Synthetic placement scoring for institutes with no history

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite + React 19)           │
│   Dashboard │ Portfolio │ Heatmap │ Reports │ Institutes     │
│              AI Agents │ Admin Panel │ Student Profile        │
└──────────────────────────┬───────────────────────────────────┘
                           │  REST API (JSON)
┌──────────────────────────▼───────────────────────────────────┐
│                 FastAPI Backend  (port 8001)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │   Scoring    │  │    Agent     │  │    Real Data      │   │
│  │   Engine     │  │ Orchestrator │  │     Fetcher       │   │
│  │  (XGB+LGBM)  │  │  (5 agents)  │  │   (World Bank)    │   │
│  └──────────────┘  └──────────────┘  └───────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │     SHAP     │  │     Tool     │  │      Data         │   │
│  │  Explainer   │  │   Registry   │  │   Generator       │   │
│  └──────────────┘  └──────────────┘  └───────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## 🤖 The AI Agent System

Five specialized **LLM-powered agents** replace formerly static, hard-coded systems:

| # | Agent | Replaces | Purpose |
|---|---|---|---|
| 1 | **NBA Agent** | Static rule tables | Recommends highest-ROI interventions using SHAP drivers + EMI data |
| 2 | **Explainability Agent** | Hard-coded NLG templates | Translates ML outputs into human-readable risk narratives |
| 3 | **Market Intelligence Agent** | Static WoW thresholds | Detects placement shocks from live labour-market signals |
| 4 | **Career Path Agent** | Static adjacency maps | Recommends career pivots weighted by regional demand |
| 5 | **Offer Survival Agent** | Secondary classifiers | Scores probability of offer revocation using company-health signals |

### 🔄 Multi-Provider LLM Support

Switch providers via a single `.env` variable — no code changes:

| Provider | Model | Best For |
|---|---|---|
| **Groq** | `llama-3.3-70b-versatile` | ⚡ Fastest inference |
| **Anthropic** | `claude-sonnet-3.5` | 🛠️ Best tool use |
| **OpenRouter** | Aggregator (Claude / Llama / Gemini) | 🔀 Flexibility |
| **OpenAI** | `gpt-4o` | 🧠 General purpose |

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10+ | Runtime |
| FastAPI | Latest | REST API framework |
| XGBoost | Latest | Classification model |
| LightGBM | Latest | Salary regression model |
| SHAP | Latest | Model explainability |
| LiteLLM | ≥ 1.50 | Multi-provider LLM abstraction |
| Pandas / NumPy | Latest | Data processing |
| Uvicorn | Latest | ASGI server |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19 | UI framework |
| Vite | 8 | Build tool & dev server |
| React Router | 7 | Client-side routing |
| Recharts | 3 | Data visualisation |
| Lucide React | Latest | Icon system |
| Axios | Latest | HTTP client |

### Design System
- **Brand**: Poonawalla Fincorp corporate identity
- **Primary Colours**: Navy `#1B2C5E` · Corporate Blue `#1E56C7`
- **Typography**: Lato + Inter
- **Themes**: Dark mode (default) + Light mode toggle

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Minimum Version |
|---|---|
| **Python** | 3.10+ |
| **Node.js** | 18+ |
| **npm** | 9+ |
| **Git** | Any |

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-org/PlacementIQ.git
cd PlacementIQ
```

### 2️⃣ Backend Setup

```bash
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

### 3️⃣ Configure Environment

Create a `.env` file in the `backend/` directory:

```env
# Choose your LLM provider: groq | anthropic | openrouter | openai
PROVIDER=groq

# Provide the matching API key
GROQ_API_KEY=gsk_your_key_here
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_API_KEY=sk-...
# OPENROUTER_API_KEY=sk-or-...
```

> 💡 **Note**: The LLM API key is only required for **agentic features** (NBA, Explainability, Career Paths, Offer Survival). Core ML scoring, the heatmap, shock detection, and all dashboard features work without any key.

### 4️⃣ Generate Synthetic Data

```bash
python data_generator.py
```

Produces `data/synthetic_students.csv` with **10,000 student records**.

### 5️⃣ Start the Backend

```bash
python main.py
```

Backend runs on **[http://localhost:8001](http://localhost:8001)**. Verify:

```bash
curl http://localhost:8001/health
# → {"status":"ok","students_loaded":10000}
```

### 6️⃣ Frontend Setup

In a **new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **[http://localhost:5173](http://localhost:5173)**. Open it in your browser.

---

## ✅ Quick Verification

After setup, verify these work:

| Check | URL / Action | Expected |
|---|---|---|
| Backend health | `GET http://localhost:8001/health` | `{"status":"ok"}` |
| Dashboard loads | Open `http://localhost:5173` | Portfolio overview with risk cards |
| Student data | `GET http://localhost:8001/api/v1/students?limit=5` | JSON array of 5 students |
| Heatmap data | `GET http://localhost:8001/api/v1/heatmap/demand` | 18-cell demand grid |
| Theme toggle | Click sun/moon icon in sidebar | Switches dark ↔ light mode |

---

## 📸 Outputs — Working Prototype Screenshots

> All screenshots captured from the live prototype running at `http://localhost:5173` (Frontend) + `http://localhost:8001` (Backend, 10,000 students loaded).
> 🎬 **Prefer a video?** [**Watch the full demo on Google Drive →**](https://drive.google.com/drive/folders/1yOtAta0nSEQPCaNb2IFFw2OgZiMW4W31?usp=sharing)

### 🗂️ Quick Index

| # | Module | Output |
|---|---|---|
| 1–3 | **Dashboard** | Cohort overview, charts, priority watchlist |
| 4 | **Heatmap** | Field × Region demand grid |
| 5–7 | **Reports & Drift** | PSI monitor, bulk scoring, score history |
| 8–10 | **Institutes** | Momentum, peer velocity, cold-start |
| 11–12 | **AI Agents** | Command centre + live pipeline output |
| 13–15 | **Admin Panel** | Risk thresholds, NBA costs, model + fairness |

---

### 1. Portfolio Cohort Dashboard — Overview

> Main landing page. Real-time KPIs: **10,000** total portfolio · **1,441 HIGH-risk** students · **36.4%** 6-month placement velocity · **7.31** avg CGPA · **5 AI agents** active. Includes a live placement-shock alert (IT Services) and the Early Alert Engine summary.

![Dashboard Overview](docs/screenshots/01_dashboard_overview.png)

---

### 2. Dashboard — Risk Distribution, Placement Velocity & Regional Breakdown

> Three analytics panels: (1) Donut chart splitting 10K students into High / Medium / Low risk bands. (2) Placement-velocity progress bars for 3-month (2.8%), 6-month (36.4%) and 12-month (80.3%) horizons. (3) Top Regions bar chart and Course Mix breakdown (MBA 3,408 · Engineering 3,302 · Nursing 3,290).

![Dashboard Charts](docs/screenshots/02_dashboard_charts.png)

---

### 3. Priority Student Watchlist

> Filterable table of at-risk students. Columns: Student ID, Course + Tier + Region, CGPA (colour-coded), Monthly EMI, 6M placement status (dot indicator), Risk Band badge (HIGH / MEDIUM / LOW), and a one-click **Analyze** button. Filter tabs for ALL / HIGH / MEDIUM / LOW.

![Priority Student Watchlist](docs/screenshots/03_priority_watchlist.png)

---

### 4. Dynamic Employability Heatmap

> Real-time **Field × Region demand grid** sourced from World Bank + India job-portal data. Rows: Engineering, MBA, Nursing. Columns: Bengaluru, Hyderabad, Delhi NCR, Pune, Mumbai, Chennai. Each cell shows a demand score (0–100), YoY trend, and risk level. Avg demand: Engineering 73/100, MBA 75/100, Nursing 76/100.

![Dynamic Employability Heatmap](docs/screenshots/04_heatmap.png)

---

### 5. Reports & Analytics — Model Drift Monitor (PSI)

> Population Stability Index panel. **Overall PSI: 0.025 (STABLE)** · Last 30 days · No alerts. Feature-level PSI bars for `lgbm`, `field_demand_score`, `behavioral_activity_score`, `macro_climate_index`, `fd`, `internship_months` — all within acceptable drift bounds.

![Model Drift Monitor](docs/screenshots/05_reports_drift_monitor.png)

---

### 6. Reports & Analytics — Bulk Portfolio Scoring (F-09)

> Batch scoring tool: paste up to **1,000 Student IDs**, click **Run Batch Score**. Results table shows Risk Band, 6M placement probability, Expected Salary, and EMI Comfort ratio per student. Example: STU-2026-00001 → **HIGH** risk, 99% prob, ₹99,000 salary, 0.28× EMI comfort.

![Bulk Portfolio Scoring](docs/screenshots/06_reports_bulk_scoring.png)

---

### 7. Reports & Analytics — 90-Day Score History & Trend (F-11)

> Longitudinal view of a student's placement-probability trajectory over **90 days** (Feb–Apr 2026). Line chart with weekly snapshots and risk-band threshold lines. STU-2026-00003 shows an **Improving** trend, crossing from MEDIUM toward LOW risk band.

![90-Day Score History](docs/screenshots/07_reports_score_history.png)

---

### 8. Institute Intelligence — Momentum Index (§10.12)

> Horizontal bar chart ranking institutes by recruiter-visits-to-offers ratio. **IIT Bombay** STRONG (1.2×) · **BITS Pilani** STABLE (1.16×) · **NIT Pune** STABLE (0.97×). Alert flags **3 institutes** in declining momentum — automatic tier-score adjustments applied.

![Institute Momentum Index](docs/screenshots/08_institutes_momentum.png)

---

### 9. Institute Intelligence — Batch Peer Velocity Tracker (F-11)

> Cohort-level placement-velocity grid broken down by **Course × Institute Tier**. Cards show total cohort size, % placed, and alert status (Critical / Stable / Normal). Identifies Engineering Tier-A 2026 cohorts as **Critical** — lagging, students urgently need intervention.

![Batch Peer Velocity](docs/screenshots/09_institutes_peer_velocity.png)

---

### 10. Institute Intelligence — Cold-Start Scoring (F-09)

> AI-based **synthetic scoring for new institutes** with no historical placement data (PRD §9.17). Input: NAAC Grade + City Tier. Output for "New Engineering College, Pune" (B+, Tier 2): **75.3%** synthetic placement probability · **₹82,823** avg salary forecast · **MEDIUM** confidence. Nearest reference institutes shown.

![Cold-Start Scoring](docs/screenshots/10_institutes_cold_start.png)

---

### 11. Agentic AI Command Center — 5 Live Agents

> Real-time view of all 5 AI agents: **NBA Agent**, **Explainability Agent**, **Market Intel Agent**, **Career Path Agent**, **Offer Survival Agent**. Live Agent Demo panel + System Architecture Flow diagram show how the orchestrator routes between ML models and JSON responses.

![AI Agents Command Center](docs/screenshots/11_ai_agents_command_center.png)

---

### 12. Agentic AI — Live Pipeline JSON Output

> Full agentic-pipeline execution result for **STU-2026-00001**. Shows raw JSON response from the orchestrator: `risk_band`, `placement_score`, `salary_range`, `shap_values`, `recommendations`, `confidence`, `percentage`, `data_gap` — alongside the Agent Capabilities & Tools reference table.

![AI Agents Live Pipeline Output](docs/screenshots/12_ai_agents_pipeline_output.png)

---

### 13. Admin Configuration Panel — Risk Band & EMI Thresholds (F-12)

> Lender-configurable risk thresholds. Dual sliders set **HIGH / MEDIUM cutoffs** for 6-month placement probability. **EMI Comfort Tier** sliders set Comfortable / Adequate / Tight boundaries. Lender profile: Demo Fincorp · UNO-DEMO-001 · 50,000 max students · MFA enabled.

![Admin Risk Thresholds](docs/screenshots/13_admin_risk_thresholds.png)

---

### 14. Admin — Early Alert Engine & NBA Intervention Cost Table

> **Early Alert Engine**: configurable Critical CGPA threshold (6) and Medium CGPA threshold (7), max 100 alerts per run. **NBA Intervention Cost Table** lists ROI inputs used by the Next-Best-Action simulator: Mock Interviews ₹0 · Python Analytics Course ₹2,000 · Improve IQI Score ₹1,500 · Behavioral Activity ₹500 · Diversify Applications ₹0.

![Admin Alert & NBA Costs](docs/screenshots/14_admin_alert_nba_costs.png)

---

### 15. Admin — Model Configuration & Fairness Audit (§16.2)

> **Champion model card**: v2.0-prototype · deployed 2026-05-01 · F1\_6m = **0.86** · Salary MAPE = **0.126** · PSI = **0.025** · traffic 100%. Challenger slot inactive. **Model Fairness Audit**: Region disparity 2.6% ✅ · Course disparity 0.6% ✅ · **Institute Tier disparity 80.5% ❌** (exceeds 10% threshold, 30-day SLA).

![Admin Model Config & Fairness Audit](docs/screenshots/15_admin_model_fairness.png)

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/score/student` | Full agentic scoring (ML + AI agents) |
| `POST` | `/api/v1/score/student/fast` | ML-only scoring (~50ms) |
| `POST` | `/api/v1/score/batch` | Batch scoring (up to 1,000 students) |
| `GET` | `/api/v1/students?limit=N` | List students from portfolio |
| `GET` | `/api/v1/student/{id}` | Full scored profile for a student |
| `GET` | `/api/v1/cohort/summary` | Portfolio-level aggregates |

### AI Agent Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/student/{id}/career-paths` | Career-pivot recommendations |
| `GET` | `/api/v1/student/{id}/offer-survival?company=X` | Offer revocation probability |
| `GET` | `/api/v1/shocks/active` | Active placement shocks (real data) |

### Monitoring & Compliance

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/model/drift` | PSI drift monitoring |
| `GET` | `/api/v1/model/metadata` | Model version & metrics |
| `GET` | `/api/v1/student/{id}/history` | 90-day score history |
| `GET` | `/api/v1/student/{id}/audit-report` | Compliance audit report |
| `GET` | `/api/v1/alerts/active` | Early-alert engine |
| `GET` | `/api/v1/heatmap/demand` | Employability heatmap |
| `GET` | `/api/v1/cohort/velocity` | Peer placement velocity |
| `POST` | `/api/v1/feedback` | Outcome submission (retraining loop) |
| `POST` | `/api/v1/institute/cold-start` | New-institute scoring |

📚 Full interactive docs: **[http://localhost:8001/docs](http://localhost:8001/docs)**

---

## 📊 Frontend Pages

| Page | Route | Description |
|---|---|---|
| **Dashboard** | `/` | Portfolio KPIs, risk distribution, watchlist, top alerts |
| **Portfolio** | `/students` | Student search, filters, individual risk cards |
| **Student Profile** | `/student/:id` | Deep dive: SHAP, NBA, score history, simulations |
| **Heatmap** | `/heatmap` | Field × Region demand grid with trend indicators |
| **Reports & Drift** | `/reports` | PSI drift, feature stability, audit export |
| **Institutes** | `/institutes` | Institute benchmarking, cold-start scoring |
| **AI Agents** | `/agentic` | Agent activity viewer, orchestration flow |
| **Admin Panel** | `/admin` | Model config, provider settings, data management |

---

## 🔐 Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PROVIDER` | Optional | LLM provider: `groq`, `anthropic`, `openrouter`, `openai` |
| `GROQ_API_KEY` | If using Groq | Groq API key |
| `ANTHROPIC_API_KEY` | If using Anthropic | Anthropic API key |
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `OPENROUTER_API_KEY` | If using OpenRouter | OpenRouter API key |
| `RECOVERY_COST_INR` | Optional | Default loan-recovery cost (₹180,000) |
| `SHOCK_THRESHOLD_WOW` | Optional | Week-over-week drop threshold for shock detection (0.15) |

---

## 📈 Model Performance

| Metric | Value |
|---|---|
| Classification F1 (6-month) | **0.86** |
| Salary MAPE | **12.6%** |
| Training records | 8,000 |
| Evaluation records | 2,000 |
| Inference latency (ML-only) | ~50 ms |
| Inference latency (full agentic) | ~3–5 s |
| Population Stability Index (PSI) | 0.025 (STABLE) |

---

## 📁 Project Structure

```
PlacementIQ/
├── README.md
├── PlacementIQ_PRD_v2.md                # Product Requirements Document
├── PLACEMENTIQ_AGENTIC_IMPLEMENTATION.md
│
├── backend/
│   ├── main.py                          # FastAPI app — 32 endpoints
│   ├── scoring_engine.py                # XGBoost + LightGBM + SHAP pipeline
│   ├── model_pipeline.py                # Model training & persistence
│   ├── data_generator.py                # Synthetic student data (10K records)
│   ├── real_data_fetcher.py             # World Bank + India market data
│   ├── config.py                        # Environment & provider configuration
│   ├── requirements.txt                 # Python dependencies
│   ├── .env                             # API keys (not committed)
│   ├── agents/
│   │   ├── orchestrator.py              # Agent orchestration & parallelisation
│   │   ├── provider.py                  # Multi-LLM provider abstraction
│   │   ├── base_agent.py                # Base agent class (tool calling)
│   │   ├── tools.py                     # Tool registry with caching layer
│   │   ├── nba_agent.py                 # Next-Best-Action recommendations
│   │   ├── explainability_agent.py      # Human-readable risk narratives
│   │   ├── market_agent.py              # Placement-shock detection
│   │   ├── career_path_agent.py         # Career-pivot recommendations
│   │   └── offer_survival_agent.py      # Offer-revocation probability
│   ├── data/
│   │   ├── synthetic_students.csv       # Generated student dataset
│   │   └── market_data.json             # Cached market intelligence
│   └── models/                          # Trained model artefacts
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   └── src/
│       ├── main.jsx                     # App entry point
│       ├── App.jsx                      # Layout, sidebar, routing
│       ├── App.css                      # Theme-specific glassmorphism
│       ├── index.css                    # Design system tokens (800+ lines)
│       ├── components/
│       │   └── Background3D.jsx         # Animated 3D background
│       ├── context/
│       │   └── ThemeContext.jsx         # Dark / Light theme provider
│       └── pages/
│           ├── Dashboard.jsx            # Portfolio overview + risk cards
│           ├── StudentProfile.jsx       # Individual student deep dive
│           ├── Heatmap.jsx              # Field × Region demand grid
│           ├── Reports.jsx              # Drift monitoring + audit
│           ├── Institutes.jsx           # Institute benchmarking
│           ├── AgenticInsights.jsx      # AI-agent activity viewer
│           └── Admin.jsx                # Settings + configuration
│
├── docs/
│   └── screenshots/                     # Prototype output screenshots (15 files)
│
└── .gitignore
```

---

<p align="center">
  <a href="https://drive.google.com/drive/folders/1yOtAta0nSEQPCaNb2IFFw2OgZiMW4W31?usp=sharing">
    🎬 <strong>Watch the Full Demo Video</strong> 🎬
  </a>
</p>

<p align="center">
  <strong>PlacementIQ v2.0</strong> — Built by <strong>Team TenzorX</strong> for <strong>Poonawalla Fincorp</strong><br/>
  <sub>Career Risk Intelligence • Agentic AI • Education Loan Analytics</sub>
</p>

<p align="center">
  <sub>© 2026 Poonawalla Fincorp · All rights reserved · Proprietary</sub>
</p>
