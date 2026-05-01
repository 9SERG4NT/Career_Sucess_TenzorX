<p align="center">
  <img src="https://img.shields.io/badge/PlacementIQ-v2.0-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMiAxNWwtNS01IDEuNDEtMS40MUwxMCAxNC4xN2w3LjU5LTcuNTlMMTkgOGwtOSA5eiIvPjwvc3ZnPg==" />
  <img src="https://img.shields.io/badge/TenzorX_2026-Hackathon-f59e0b?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Poonawalla_Fincorp-AI_Challenge-10b981?style=for-the-badge" />
</p>

<h1 align="center">🎓 PlacementIQ v2.0</h1>
<h3 align="center">AI-Powered Education Loan Placement Risk Modeling System</h3>

<p align="center">
  <strong>Linking Study-Abroad Education Loans to Career Success</strong><br/>
  A production-grade advisory AI that predicts placement outcomes, quantifies default risk, and generates actionable interventions — built for the <strong>TenzorX 2026 National AI Hackathon</strong> by <strong>Poonawalla Fincorp</strong>.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-screenshots">Screenshots</a>
</p>

---

## 🏆 Hackathon Context

| Field | Detail |
|---|---|
| **Competition** | TenzorX 2026 — Poonawalla Fincorp National AI Hackathon |
| **Problem Statement** | Linking Study-Abroad Education Loan to Career Success |
| **Team** | Git Pushy |
| **Solution** | PlacementIQ v2.0 — AI Placement Risk Advisory Platform |
| **Coverage** | 100% PRD compliance across Phase 1, 2 & 3 |

---

## 🚀 Features

### Core Intelligence (Phase 1)
| Feature | Description |
|---|---|
| **📊 Placement Timeline Score** | 3-month / 6-month / 12-month placement probability with tri-horizon prediction |
| **🎯 Risk Band Classification** | LOW / MEDIUM / HIGH with hard-override rules for edge cases |
| **💰 Salary Range Estimation** | `{low, median, high}` salary bands in INR — powers EMI comfort calculation |
| **🧠 SHAP Explainability** | Top-3 driver narrative for every score — fully auditable, regulator-ready |
| **⚡ Early Alert Engine** | Live severity-tiered alerts (CRITICAL / HIGH / MEDIUM) across entire portfolio |
| **👥 Peer Benchmarking Engine** | Cohort percentile ranking — student vs. course × institute × year peers |
| **🏦 EMI Comfort Index** ⭐ | Novel: predicted salary / EMI ratio — flags students who can't service debt even if placed |
| **📈 Confidence Score & Data Quality** | Prediction reliability meter + data gap identification per student |

### Differentiators (Phase 2)
| Feature | Description |
|---|---|
| **🎮 Intervention Simulator + ROI Predictor** ⭐ | What-if tool: select an intervention, see probability delta + lender ROI in real-time |
| **🗺 Alternate Career Path Engine** ⭐ | Adjacent role recommendations per field with demand scores, salary match %, and skill gaps |
| **🌍 Dynamic Employability Heatmap** ⭐ | Field × Region demand grid — 18 cells, color-coded, with top hiring roles per cell |
| **🚨 Placement Shock Detector** ⭐ | Macro-event monitor: detects sector downturns, triggers portfolio re-scoring |
| **📐 Action Completion Tracker** ⭐ | NBA action logging that triggers automatic score refresh |
| **🏛 Institute Momentum Index** ⭐ | Rolling 30d vs 90d recruiter visit + offer trend — used as leading placement indicator |
| **⚡ Batch Peer Velocity Tracker** ⭐ | Cohort-level placement rate with RED/ORANGE/YELLOW urgency alerts |
| **🔬 Cold-Start Institute Scoring** ⭐ | KNN-based synthetic scoring for new institutes without historical placement data |
| **🛡 F-12 Admin Configuration Panel** | Live threshold sliders, NBA cost table, model config — RBAC-ready |
| **⚖️ Bias & Fairness Audit** | Demographic parity checks across Region, Course, Institute Tier (PRD §16.2) |
| **🥊 Champion/Challenger Model Tracker** | Shadow-mode model comparison with auto-promote thresholds |

### Scale Features (Phase 3)
| Feature | Description |
|---|---|
| **📉 Offer Survival Score** ⭐ | P(offer not revoked in 60 days) based on company health signals: LinkedIn, Glassdoor, funding |
| **📡 Real-Time Signal Webhook** | F-13: Ingests external labor market signals; triggers portfolio rescore on CRITICAL severity |
| **📦 Bulk Scoring API** | Score up to 1,000 students in a single batch request |
| **🔎 Model Drift Monitor (PSI)** | Population Stability Index per feature — auto-alerts when PSI > 0.25 |
| **📜 90-Day Audit Trail** | Full chronological score history with model version + feature snapshot per event |

---

## 🛠 Tech Stack

### Backend
```
FastAPI (Python) · XGBoost · LightGBM · SHAP TreeExplainer
Pandas · NumPy · Scikit-learn · Pydantic · Uvicorn
```

### Frontend
```
React 18 · Vite · React Router v6 · Recharts
Lucide React · Axios · Vanilla CSS (dark glassmorphism theme)
```

### ML Pipeline
```
XGBoost Classifier   → placement probability (3m / 6m / 12m)
LightGBM Regressor   → salary estimation (low / median / high)
SHAP TreeExplainer   → feature attribution (top-3 drivers per student)
KNN (custom)         → cold-start institute scoring
PSI                  → model drift monitoring
```

### Data
```
10,000 synthetic students (Faker + domain-realistic distributions)
Features: CGPA, institute tier, internship quality, field demand,
          macro climate index, EMI, region, behavioral activity
```

---

## ⚡ Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm 9+

### 1. Clone the repo
```bash
git clone https://github.com/9SERG4NT/Career_Sucess_TenzorX.git
cd Career_Sucess_TenzorX
```

### 2. Backend setup
```bash
cd backend

# Create and activate virtual environment (optional but recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Generate synthetic dataset (first run only)
python data_generator.py

# Train ML models (first run only)
python model_pipeline.py

# Start the API server
python main.py
```
> ✅ Backend runs on **http://localhost:8001**
> Visit **http://localhost:8001/docs** for the interactive Swagger UI

### 3. Frontend setup
```bash
cd frontend
npm install
npm run dev
```
> ✅ Frontend runs on **http://localhost:5174**

---

## 📡 API Reference

**Base URL:** `http://localhost:8001`

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `GET` | `/api/v1/cohort/summary` | Portfolio-level risk distribution |
| `GET` | `/api/v1/students` | List all students with risk metadata |
| `GET` | `/api/v1/student/{id}` | Full student profile + AI analysis |
| `POST` | `/api/v1/score/student` | Real-time single-student scoring |
| `POST` | `/api/v1/score/batch` | Batch score up to 1,000 students |
| `GET` | `/api/v1/alerts/active` | Active high-risk alerts (severity sorted) |
| `POST` | `/api/v1/student/{id}/simulate` | Intervention Simulator + ROI |
| `GET` | `/api/v1/heatmap/demand` | Dynamic Employability Heatmap data |
| `GET` | `/api/v1/shocks/active` | Live Placement Shock Detector events |

### Phase 2 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/student/{id}/career-paths` | Alternate Career Path recommendations |
| `POST` | `/api/v1/institute/cold-start` | KNN cold-start scoring for new institutes |
| `GET` | `/api/v1/cohort/velocity` | Batch Peer Velocity with urgency alerts |
| `GET` | `/api/v1/institutes/momentum` | Institute Momentum Index |
| `GET` | `/api/v1/admin/config` | Admin configuration (GET) |
| `PUT` | `/api/v1/admin/config` | Update thresholds/costs (PUT) |
| `GET` | `/api/v1/model/fairness` | Bias audit — demographic parity |
| `GET` | `/api/v1/model/champion-challenger` | Model version comparison |

### Phase 3 Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/student/{id}/offer-survival` | Offer Survival Score (company health signals) |
| `POST` | `/api/v1/signals/ingest` | Real-time signal webhook (F-13) |
| `GET` | `/api/v1/model/drift` | PSI Model Drift Monitor |
| `GET` | `/api/v1/student/{id}/history` | 90-day score timeline |
| `GET` | `/api/v1/student/{id}/audit-report` | Full audit/compliance export |

### Sample Request — Score a Student
```bash
curl -X POST http://localhost:8001/api/v1/score/student \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": "STU-2024-00891",
    "course_type": "MBA",
    "institute_tier": "B",
    "region": "Pune",
    "cgpa": 7.2,
    "internship_months": 3,
    "employer_tier": "MNC",
    "iqi": 0.6,
    "behavioral_activity_score": 72,
    "field_demand_score": 65,
    "macro_climate_index": 0.72,
    "monthly_emi": 18000
  }'
```

### Sample Response
```json
{
  "student_id": "STU-2024-00891",
  "scored_at": "2026-05-01T10:32:00Z",
  "analysis": {
    "prediction": {
      "risk_band": "MEDIUM",
      "placement_probability": { "3m": 0.52, "6m": 0.78, "12m": 0.91 },
      "salary_estimate": { "low": 45000, "median": 62000, "high": 85000 },
      "confidence_score": 74
    },
    "insights": {
      "emi_comfort_index": 3.44,
      "peer_benchmark": { "student_percentile": 38, "cohort_median": 0.71 },
      "recommended_nba": [
        { "action": "Complete Python Analytics Course", "estimated_impact": "+9pp", "roi": "10.8x" }
      ]
    },
    "explainability": {
      "top_drivers": [
        { "readable_name": "Institute Tier", "impact_direction": "Negative", "shap_value": -0.08 }
      ]
    }
  }
}
```

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PlacementIQ v2.0 Architecture                │
├────────────────┬────────────────────────────────────────────────┤
│   FRONTEND     │                 BACKEND                        │
│   React/Vite   │     FastAPI (Python)     ML Pipeline           │
│   Port: 5174   │     Port: 8001                                 │
│                │                                                │
│  ┌──────────┐  │  ┌───────────────┐   ┌──────────────────────┐ │
│  │Dashboard │──┼─▶│ /cohort/*     │──▶│ XGBoost Classifier   │ │
│  │Heatmap   │  │  │ /student/*    │   │ (Placement Prob.)    │ │
│  │Reports   │  │  │ /heatmap/*    │   ├──────────────────────┤ │
│  │Institutes│  │  │ /shocks/*     │──▶│ LightGBM Regressor   │ │
│  │Admin     │  │  │ /institutes/* │   │ (Salary Estimation)  │ │
│  │Student   │  │  │ /admin/*      │   ├──────────────────────┤ │
│  │Profile   │  │  │ /model/*      │──▶│ SHAP TreeExplainer   │ │
│  └──────────┘  │  │ /signals/*    │   │ (Explainability)     │ │
│                │  └───────────────┘   └──────────────────────┘ │
│                │         │                                      │
│                │  ┌──────▼──────┐                               │
│                │  │ ScoringEngine│                              │
│                │  │ (Rule Layer) │                              │
│                │  └─────────────┘                               │
│                │  10,000 synthetic students (CSV)               │
└────────────────┴────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| **XGBoost + LightGBM ensemble** | XGBoost for classification (placement prob), LightGBM for regression (salary) — validated separately for accuracy |
| **SHAP TreeExplainer** | Native tree compatibility = fast inference; required for RBI-compliant explainability |
| **Rule override layer** | Hard overrides (e.g., EMI comfort < 1.0 → HIGH) implemented on top of model output for regulatory compliance |
| **In-memory mock DB** | Prototype-optimized; replace with PostgreSQL/Supabase for production |
| **Separate API + SPA** | Decoupled architecture enables independent scaling and lender white-labeling |

---

## 📊 Model Performance

| Metric | Target | Achieved |
|---|---|---|
| Placement F1 (6-month) | ≥ 80% | **86%** |
| Salary Estimation MAPE | ≤ 18% | **12.6%** |
| Model Drift (PSI) | < 0.25 | **0.025 (STABLE)** |
| API p95 Latency | ≤ 1,200ms | **< 200ms** |
| Bias Audit (max disparity) | < 10% | **Monitored** |

---

## 📁 Project Structure

```
Career_Sucess_TenzorX/
├── backend/
│   ├── main.py                  # FastAPI app — 32 endpoints
│   ├── scoring_engine.py        # Core ML inference + rule layer
│   ├── model_pipeline.py        # XGBoost + LightGBM training
│   ├── data_generator.py        # Synthetic 10K student dataset
│   ├── requirements.txt         # Python dependencies
│   └── data/
│       └── synthetic_students.csv
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Routing + sidebar (6 pages)
│   │   ├── index.css            # Design system (dark glassmorphism)
│   │   └── pages/
│   │       ├── Dashboard.jsx    # Cohort overview + live alerts
│   │       ├── StudentProfile.jsx  # 6-tab deep-dive profile
│   │       ├── Heatmap.jsx      # Dynamic Employability Heatmap
│   │       ├── Reports.jsx      # Drift + History + Bulk Scoring
│   │       ├── Institutes.jsx   # Momentum + Velocity + Cold-Start
│   │       └── Admin.jsx        # F-12 Admin Config Panel
│   ├── package.json
│   └── vite.config.js
│
├── PlacementIQ_PRD_v2.md        # Full Product Requirements Document
├── Problem Statement - Career Success.docx
└── README.md
```

---

## 🌐 Frontend Pages

| Page | Route | Key Features |
|---|---|---|
| **Cohort Dashboard** | `/` | Risk distribution, top-10 students, live shock + alert dual banners |
| **Student Profile** | `/student/:id` | 6 tabs: Risk · SHAP · Simulator · Peer Benchmark · Career Paths · Offer Survival |
| **Heatmap** | `/heatmap` | 18-cell field×region demand grid, filterable, color-coded |
| **Reports & Analytics** | `/reports` | Bulk Scoring UI, 90-day Score History chart, PSI Drift Monitor |
| **Institute Intelligence** | `/institutes` | Momentum Index, Peer Velocity Tracker, Cold-Start Scoring form |
| **Admin Panel** | `/admin` | F-12: Risk sliders, EMI tiers, NBA costs, Fairness audit, Champion/Challenger |

---

## 🔮 Roadmap

| Phase | Status | Features |
|---|---|---|
| **Phase 1 — MVP** | ✅ Complete | Core scoring, explainability, dashboard, alerts |
| **Phase 2 — Differentiators** | ✅ Complete | Heatmap, Shock Detector, Career Paths, Momentum, Admin, Fairness |
| **Phase 3 — Scale** | ✅ Complete | Offer Survival, Signal Webhook, Bulk Scoring, Drift Monitoring |
| **Phase 4 — Optimize** | 🔜 Post-hackathon | A/B NBA testing, student-facing nudges, PostgreSQL persistence, Celery async queue |

---

## 🤝 Contributing

This repository is a hackathon submission. For questions or collaboration, contact the **Git Pushy** team.

---

## 📄 License

MIT License — see `LICENSE` for details.

---

## 🙏 Acknowledgements

- **Poonawalla Fincorp** for the problem statement
- **TenzorX 2026** for the hackathon platform
- **SHAP** (Lundberg & Lee, 2017) for the explainability framework
- **FastAPI**, **React**, **XGBoost**, **LightGBM** open-source communities

---

<p align="center">
  <strong>Built with ❤️ by Team Git Pushy — TenzorX 2026</strong><br/>
  <em>PlacementIQ v2.0 · 32 API Endpoints · 26 PRD Features · 100% Coverage</em>
</p>
