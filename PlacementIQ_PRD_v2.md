# PlacementIQ — AI-Powered Placement Risk Modeling System
## Product Requirements Document v2.0

---

| Field | Value |
|---|---|
| **Product Name** | PlacementIQ |
| **Version** | 2.0 — Hackathon Submission Build |
| **Team** | Git Pushy — Sumukh Chourasia, Parth Choudhari, Sukhada Bhoyar |
| **Event** | TenzorX 2026 National AI Hackathon — Poonawalla Fincorp Education Loan |
| **Date** | May 2026 |
| **Classification** | Internal — Prototype Specification |
| **Sponsor Problem** | Linking Study Abroad Education Loans to Career Success Using AI |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement & Background](#2-problem-statement--background)
3. [Hackathon Scope & Prototype Boundary](#3-hackathon-scope--prototype-boundary)
4. [Goals & Non-Goals](#4-goals--non-goals)
5. [User Personas & Stakeholders](#5-user-personas--stakeholders)
6. [System Architecture & Data Flow](#6-system-architecture--data-flow)
7. [Data Requirements & Feature Engineering](#7-data-requirements--feature-engineering)
8. [ML Model Design & Logic](#8-ml-model-design--logic)
9. [Core Features — Phase 1 MVP](#9-core-features--phase-1-mvp)
10. [Unique Differentiator Features](#10-unique-differentiator-features)
11. [API Specification](#11-api-specification)
12. [Risk Classification Logic](#12-risk-classification-logic)
13. [Next-Best-Action (NBA) Engine](#13-next-best-action-nba-engine)
14. [Non-Functional Requirements](#14-non-functional-requirements)
15. [Success Metrics & KPIs](#15-success-metrics--kpis)
16. [Compliance, Privacy & Ethics](#16-compliance-privacy--ethics)
17. [Implementation Roadmap](#17-implementation-roadmap)
18. [Open Questions & Assumptions](#18-open-questions--assumptions)
19. [Feature Summary Matrix](#19-feature-summary-matrix)
20. [Glossary](#20-glossary)

---

## 1. Executive Summary

PlacementIQ is a predictive intelligence platform that gives education loan lenders **3–12 months of early warning** on student employability risk — before a single EMI is missed. It forecasts a student's probability of securing employment at three time horizons, estimates their expected starting salary, detects macro-level hiring shocks, and recommends quantified interventions — all with full explainability for compliance.

**Study-Abroad Context:** PlacementIQ is designed for the **study-abroad education loan** segment — where lenders finance students pursuing higher education at international universities. The employability risk in this segment is uniquely complex: it involves cross-border labor markets, visa-dependent employment timelines (OPT/CPT in the US, PSW in the UK, post-study work permits in Canada/Australia/Germany), destination-country hiring cycles, and currency-adjusted salary expectations. PlacementIQ's architecture accounts for these dimensions through its multi-geography demand modeling, currency-normalized salary estimation, and region-aware risk classification. Phase 1 MVP demonstrates the core prediction engine using Indian placement data as a representative training set, with the international data pipeline (destination-country labor APIs, visa outcome data, and global university tier mappings) designed for Phase 2 expansion.

**What makes v2.0 different from standard risk tools:** PlacementIQ v2.0 goes beyond prediction into *optimization*. It tells a lender not just that a student is at risk, but exactly what intervention would reduce that risk, what it would cost, and whether the student actually followed through. It layers dynamic market intelligence (real-time sector hiring shocks, regional demand heatmaps) on top of individual-student scoring, and uses a novel EMI Comfort Index to catch the "placed but can't repay" underemployment scenario that all current tools miss entirely.

> **Core target:** 15–25% reduction in early-stage delinquencies within 12 months of deployment. Break-even at 2,000 active borrowers in under 6 months.

PlacementIQ is an advisory tool. It augments human judgment — all final credit and support decisions remain with lender relationship managers.

---

## 2. Problem Statement & Background

> **Sponsor Problem Statement:** *"Linking Study-Abroad Education Loan to Career Success Using AI"* — Design an AI-powered Placement-Risk Modeling system for education-loan borrowers that predicts placement timelines, estimates starting salaries, and identifies students who may face delays impacting repayment ability.

### 2.1 The Four Gaps

Education loan lenders currently operate with four compounding blind spots:

**Gap 1 — Outdated Underwriting.** Loan decisions rely on CGPA and co-signers. Neither variable predicts post-graduation employability. A student with a 9.0 CGPA from a Tier-D institute in a sector with collapsing demand is statistically higher-risk than a 7.0 student from a Tier-B institute with two MNC internships.

**Gap 2 — Zero Visibility.** Lenders have no data on a student's likelihood of securing employment. The first signal of trouble is a missed EMI — 6–18 months after the risk was detectable.

**Gap 3 — Reactive Recovery.** Student counselling, EMI restructuring, and support programs are triggered only after delinquency. At that point, recovery costs average ₹1.8L per default.

**Gap 4 — Static Models.** Existing credit models don't adapt to shifting market demand. A mass tech-sector layoff event in Q3 is not reflected in any underwriting score until loan losses appear in Q1 of the following year.

### 2.2 The Opportunity

A well-designed AI system aggregating multi-source data — academic records, institute placement history, industry labor-market indicators, and real-time behavioral signals — can predict placement risk **3–12 months before repayment milestones** and trigger targeted, cost-quantified interventions. PlacementIQ delivers this window.

### 2.3 Additional v2.0 Problem: Underemployment

Even a "successfully placed" student can default if their starting salary cannot comfortably service their EMI. Current tools declare risk resolved when a job offer is received. PlacementIQ v2.0 introduces the **EMI Comfort Index** to flag this underemployment scenario, and the **Offer Survival Score** to detect offer-reversal risk for students placed at financially distressed employers.

---

## 3. Hackathon Scope & Prototype Boundary

This PRD describes the **complete product vision** for PlacementIQ. For the TenzorX 2026 Hackathon submission, the following scope applies:

### 3.1 What Is Built & Demo-Ready (Hackathon Prototype)

| Component | Status | Notes |
|---|---|---|
| Placement Timeline Prediction (3/6/12m) | ✅ Built | XGBoost classifier with synthetic training data |
| Salary Range Estimation | ✅ Built | LightGBM quantile regression |
| Risk Band Classification (Low/Medium/High) | ✅ Built | Model output + hard override rules |
| Explainability Narrative (Top-3 SHAP drivers) | ✅ Built | SHAP integration with NLG templates |
| EMI Comfort Index | ✅ Built | Salary-to-EMI ratio computation |
| Confidence Score & Data Quality Meter | ✅ Built | Completeness-weighted scoring |
| Peer Benchmarking Engine | ✅ Built | Cohort percentile ranking |
| Lender Dashboard (Individual + Cohort views) | ✅ Built | Interactive web dashboard |
| REST API (core scoring endpoints) | ✅ Built | FastAPI backend |
| Early Alert Engine | ✅ Built | Risk band change detection |

### 3.2 What Is Designed but Not Implemented (Future Phases)

- Intervention Simulator + ROI Predictor (Phase 2 — design complete)
- Placement Shock Detector real-time pipeline (Phase 2)
- Dynamic Employability Heatmap (Phase 2)
- Cold-Start Institute Scoring (Phase 2)
- Offer Survival Score (Phase 3)
- Multi-tenant deployment & SLA hardening (Phase 3)
- International university & cross-border labor market data pipeline (Phase 2)

### 3.3 Data Strategy for Demo

The hackathon prototype uses **synthetic data** generated to represent realistic student profiles across Engineering, MBA, and Nursing programs. Synthetic data distributions are calibrated against publicly available NIRF placement reports and industry salary surveys. In production, real data would be sourced from institute SIS, lender CRM, and labor market APIs (NAUKRI, LinkedIn Talent Insights, MoSPI).

---

## 4. Goals & Non-Goals

### 4.1 Goals

- Predict the probability of student job placement within 3, 6, and 12 months post-graduation with measurable accuracy (≥ 78% F1 at 6-month horizon).
- Estimate expected starting salary range by field, institute tier, and region.
- Classify each borrower into a risk band (Low / Medium / High) with full explainability.
- Surface early alerts to lenders at least 3 months before EMI start date.
- Detect macro-level sector hiring shocks in real time and auto-escalate affected student portfolios.
- Generate quantified, cost-aware intervention recommendations — not just suggestions.
- Verify whether recommended interventions were completed by students.
- Score new institutes with limited historical data using similarity-based cold-start logic.
- Provide a lender-facing dashboard with cohort, individual, regional heatmap, and intervention views.
- Be explainable: every score includes top-3 SHAP drivers, a confidence level, and a data quality indicator.
- Be scalable across course types, institute tiers, geographies, and loan portfolios.

### 4.2 Non-Goals

- PlacementIQ does NOT automate loan approval or rejection decisions.
- PlacementIQ does NOT directly share raw risk scores with students (Phase 1).
- PlacementIQ does NOT replace human relationship managers or career counsellors.
- PlacementIQ does NOT guarantee placement outcomes.
- PlacementIQ does NOT ingest biometric, caste, religion, or political data.
- PlacementIQ does NOT make final credit decisions without human-in-the-loop sign-off.

---

## 5. User Personas & Stakeholders

| Persona | Role | Primary Need | Key Interaction |
|---|---|---|---|
| **Lender Risk Analyst** | Portfolio risk owner | Early, cohort-level visibility into repayment risk | Cohort dashboard, heatmap, export reports |
| **Relationship Manager (RM)** | Student account owner | Actionable, quantified interventions for at-risk students | Student risk card, Intervention Simulator, NBA feed |
| **Institute Placement Officer** | Campus placement coordinator | Which students need urgent support; recruiter leads | Institute aggregate view (Phase 2) |
| **Product Admin** | System configurator | Threshold tuning, alert rules, institute onboarding | Admin panel |
| **Compliance Officer** | Regulatory oversight | Audit trails, explainability, bias monitoring | Compliance dashboard, SHAP export |
| **ML/Data Engineer** | Model ops | Drift monitoring, retraining pipeline, feature updates | Model ops console |

---

## 6. System Architecture & Data Flow

### 6.1 Technology Stack (Hackathon Prototype)

| Layer | Technology | Rationale |
|---|---|---|
| **Backend API** | Python 3.11 + FastAPI | High-performance async API; native ML library support |
| **ML Framework** | XGBoost, LightGBM, scikit-learn | Industry-standard gradient boosting; fast inference |
| **Explainability** | SHAP (TreeExplainer) | Model-agnostic, game-theory-based feature attribution |
| **Feature Store** | Pandas + SQLite (prototype) / Redis + PostgreSQL (production) | Lightweight for hackathon; production path clear |
| **Frontend Dashboard** | HTML/CSS/JavaScript | Interactive lender-facing dashboard |
| **Data Processing** | Pandas, NumPy | Feature engineering pipeline |
| **Deployment** | Local (prototype) / Docker + GCP Cloud Run (production) | Containerized for reproducibility |

### 6.2 Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA INGESTION LAYER                      │
│  Student SIS · Institute Portal · Labor APIs · Behavioral     │
│  Webhooks · Macro Indicators · Job Portal Signals             │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                   FEATURE ENGINEERING LAYER                   │
│  CGPA Norm · IQI · Field Demand · Institute Momentum ·        │
│  Macro Climate · Peer Velocity · Behavioral Activity Score    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     ML MODEL ENSEMBLE                         │
│  XGBoost Classifier (Placement Timeline)                      │
│  LightGBM Regressor (Salary Range)                            │
│  KNN Similarity Engine (Cold-Start Institute Scoring)         │
│  Rule Engine (Risk Band · Shock Detector · Offer Survival)    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    EXPLAINABILITY LAYER                       │
│  SHAP Values · Top-3 Drivers · NLG Summaries                  │
│  Confidence Score · Data Quality Meter                        │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│               DECISION + INTELLIGENCE LAYER                   │
│  Risk Band · Early Alert Engine · Placement Shock Detector    │
│  Peer Benchmarking · EMI Comfort Index · Offer Survival       │
│  Intervention Simulator + ROI · Action Completion Tracker     │
│  Alternate Career Path Engine · NBA Engine                    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                      API GATEWAY (REST)                       │
│  JWT Auth · Rate Limiting · Multi-tenant Isolation            │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     LENDER DASHBOARD                          │
│  Individual Risk Card · Cohort View · Regional Heatmap        │
│  Alert Feed · Intervention Simulator · Action Tracker         │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Data Flow Logic

- Batch ingestion runs nightly (T+1 day lag) for academic, institute, and macro data.
- Real-time signals (job portal activity, interview updates, macro shock events) are processed via event streaming with ≤ 15-minute lag.
- Feature store refreshes daily; model inference runs on-demand (API) and nightly (batch scoring).
- Alert engine evaluates every student's score nightly and pushes alerts when risk band changes or a sector shock is detected.
- Action Completion Tracker ingests completion events from lender-partnered course platforms and institution systems via webhooks.
- Placement Shock Detector runs an independent real-time pipeline monitoring labor market API feeds; triggers portfolio-wide escalation when sector decline exceeds configured threshold.

---

## 7. Data Requirements & Feature Engineering

### 7.1 Data Sources

| # | Category | Fields | Source | Refresh |
|---|---|---|---|---|
| 1 | **Student Academic & Program** | Course type, CGPA, semester, internship history (duration, employer tier, performance), certifications, extracurriculars | Institute SIS / Loan origination system | Per semester |
| 2 | **Institute & Program Level** | Institute tier (A/B/C/D), program-wise placement rates (3/6/12m), historic salary benchmarks, placement cell activity index, recruiter visit count, offer acceptance rate | Institute placement portal API / Manual upload | Monthly |
| 3 | **Industry & Labor Market** | Job demand index by field/region, sector hiring trends (IT, BFSI, manufacturing, healthcare), macroeconomic indicators (unemployment rate, GDP growth, layoff events), job openings per graduate | Govt. labor bureau, NAUKRI/LinkedIn APIs, Tracxn | Weekly / Real-time |
| 4 | **Behavioral & Real-Time Signals** | Job portal sessions, applications submitted, interview pipeline stage, resume update recency, skill platform enrollments, mock interview completions, course completions | Job portal webhooks, LMS APIs, institute updates | Real-time / Daily |
| 5 | **Employer Health Signals** | Company funding status, recent layoff announcements, Glassdoor rating trend, hiring volume trend (for Offer Survival Score) | Tracxn, Crunchbase, LinkedIn Talent Insights | Weekly |
| 6 | **Outcome Labels (Training)** | Placement status at 3/6/12m, job title, employer type (MNC/startup/govt), actual starting salary, notes on delays | Lender CRM / Institute records | Batch historical + ongoing |

### 7.2 Feature Engineering Specifications

**CGPA Score (Normalized):** CGPA mapped to a 0–1 scale relative to program and institute cohort, adjusting for grading-scale variance across institutes.

**Institute Tier Score:** Weighted composite of historic placement rate, salary benchmarks, NAAC/NBA ranking, and recruiter engagement. Scale: 1–10. Updated monthly.

**Internship Quality Index (IQI):** Combines duration (months), employer tier (MNC=1.0, startup=0.7, SME=0.5), and recency decay.
```
IQI = (duration_months × employer_weight × recency_decay_factor) / 12
```

**Field Demand Score:** Job openings per graduate in the student's discipline × region. Updated weekly from labor market APIs.

**Macro Climate Index:** Weighted composite of regional unemployment rate, sector hiring growth YoY, and GDP growth. Computed quarterly; overridden to real-time in shock events.

**Behavioral Activity Score:** Aggregated job-portal sessions, applications submitted, interview stages reached. Normalized 0–100.

**Institute Momentum Index (NEW):** Rolling 30-day recruiter visit count and offer-letter count, compared to the trailing 90-day average for the same institute. Expressed as a momentum ratio. Negative momentum triggers automatic downgrade of the Institute Tier Score contribution.
```
Momentum Ratio = (recruiter_visits_30d / avg_recruiter_visits_90d) × 0.5
              + (offers_30d / avg_offers_90d) × 0.5
```
A ratio below 0.6 triggers a momentum flag on all students at that institute.

**Peer Velocity Score (NEW):** Percentage of a student's graduating cohort (same institute + course + batch year) that has been placed as of the scoring date. Expressed as a cohort placement rate and compared against the student's individual status.

**EMI Comfort Ratio (NEW):** Predicted median salary for the student divided by their monthly EMI obligation.
```
EMI Comfort Ratio = predicted_salary_median / monthly_emi_amount
```
Ratio < 1.5 is flagged as underemployment risk. Ratio < 1.0 means even a successful placement may not prevent default.

**Data Completeness Score (NEW):** Ratio of available feature fields to total required fields, weighted by feature importance rank. Powers the Confidence Score displayed on every risk card.
```
Completeness = Σ (field_available × feature_importance_weight) / Σ feature_importance_weight
```

---

## 8. ML Model Design & Logic

### 8.1 Model Architecture

| Model | Algorithm | Output | Metric |
|---|---|---|---|
| **Placement Timeline Classifier** | XGBoost + Logistic Regression stacking ensemble | P(placed ≤ 3m) · P(placed ≤ 6m) · P(placed ≤ 12m) | F1-score per horizon, AUC-ROC, Precision@K |
| **Salary Range Estimator** | LightGBM with Quantile Regression (10th–90th percentile) | Salary range: low / median / high (INR/month) | MAPE, MAE, Quantile loss |
| **Risk Band Classifier** | Rule-augmented threshold layer on classifier output | Risk label: Low / Medium / High | Alert precision, false positive rate |
| **Cold-Start Institute Scorer (NEW)** | K-Nearest Neighbor clustering on institute feature vectors | Synthetic institute tier + placement rate proxy | Cluster coherence, hold-out MAE |
| **Offer Survival Scorer (NEW)** | Gradient Boosted Classifier on employer health signals | P(offer revocation within 60 days) | Precision, Recall |

### 8.2 Training Data Strategy

- Minimum 10,000 labeled student records with 3-year longitudinal placement outcomes.
- Stratified sampling by institute tier, course type, and graduation year to prevent class imbalance and temporal leakage.
- Train / Validation / Test split: 70% / 15% / 15%. Test set is strictly out-of-time (most recent 12 months).
- SMOTE synthetic oversampling applied for underrepresented course types (nursing, fine arts, architecture).
- Cold-Start Institute model trained on institute-level aggregate features only (no student PII), allowing generalization to new institutes via similarity.

### 8.3 Model Retraining Cadence

- Scheduled retraining: monthly, incorporating the latest 3 months of outcome labels.
- Drift-triggered retraining: automatic if Population Stability Index (PSI) exceeds 0.25 on any key feature.
- Champion/challenger deployment: new model versions shadow-deployed for 2 weeks before promotion. Automatic rollback if AUC drops more than 3%.

### 8.4 Explainability Logic

Every inference produces:

- **Top-3 positive factors:** features that reduced risk (e.g., "High-tier institute with 85% 3-month placement rate").
- **Top-3 negative factors:** features that increased risk (e.g., "No internship detected; field demand in bottom 20% nationally").
- **Confidence Score:** derived from Data Completeness Score + prediction interval width. Displayed as High / Medium / Low with a percentage and a one-line data gap note.
- SHAP values pre-computed at batch scoring time and stored in the feature store for instant API retrieval.
- Human-readable summaries generated by a rule-based NLG template engine converting SHAP drivers into plain-language sentences.

---

## 9. Core Features — Phase 1 MVP

| ID | Feature | Description | Priority | Phase |
|---|---|---|---|---|
| F-01 | **Placement Timeline Score** | Predict probability (0–100%) of placement at 3m, 6m, 12m horizons per student. Refresh nightly and on-demand via API. | P0 | 1 |
| F-02 | **Risk Band Classification** | Classify each student as Low / Medium / High based on placement probability thresholds and hard override rules. | P0 | 1 |
| F-03 | **Salary Range Estimation** | Predict expected starting salary (low / median / high) in INR/month by field, institute tier, and region. | P0 | 1 |
| F-04 | **Explainability Narrative** | Top-3 risk drivers in plain language for every score. Example: "No internship + low field demand + Tier-C institute." | P0 | 1 |
| F-05 | **Early Alert Engine** | Push alert to lender dashboard when a student crosses High-risk threshold or risk band worsens. 3-month lead time before EMI start. | P0 | 1 |
| F-06 | **NBA Recommendations** | Suggest skill-up, resume coaching, mock interviews, or recruiter matching based on top risk drivers. | P1 | 2 |
| F-07 | **Lender Dashboard — Individual View** | Risk card per student: score, band, salary estimate, top drivers, NBA, 90-day trend graph. | P0 | 1 |
| F-08 | **Lender Dashboard — Cohort View** | Risk distribution by institute, course, disbursement cohort. Filterable by geography, course type, risk band. | P1 | 1 |
| F-09 | **Bulk Scoring API** | Batch inference accepting up to 1,000 student records per request. Async with webhook callback. | P1 | 1 |
| F-10 | **Model Drift Monitoring** | PSI and feature-distribution monitoring. Alert + email to ML team if drift threshold is breached. | P1 | 2 |
| F-11 | **Audit Trail & Explainability Report** | Exportable PDF/CSV per student with full score history, model version, feature inputs, SHAP outputs. | P1 | 2 |
| F-12 | **Admin Configuration Panel** | Configurable risk thresholds, alert rules, NBA mappings, institute metadata, feature weights per lender. | P2 | 2 |
| F-13 | **Real-Time Signal Integration** | Ingest job-portal activity, interview progress, and skill-platform events via webhooks to update behavioral score. | P2 | 3 |

---

## 10. Unique Differentiator Features

These features are exclusive to PlacementIQ v2.0 and represent the primary competitive differentiation beyond baseline placement prediction.

---

### 10.1 Intervention Simulator + ROI Predictor ⭐

**What it does:** An interactive tool for relationship managers that simulates the effect of specific interventions on a student's placement probability — and quantifies the financial return to the lender.

**How it works:**
1. RM selects a student and an intervention type (e.g., "Complete Python for Data Analytics certification," "Attend 3 mock interviews," "Secure a 2-month internship").
2. The system perturbs the student's feature vector by the intervention's expected feature delta (pre-defined per intervention type based on historical outcome data).
3. The model re-scores the perturbed feature vector and returns the probability delta.
4. The system computes ROI: intervention cost (from a pre-populated cost table) vs. expected reduction in default probability × average recovery cost (₹1.8L).

**Output displayed to RM:**

```
Intervention: Complete Python for Business Analytics (₹2,000 course)
────────────────────────────────────────────────────────
  Placement probability (current):       42%  →  51% (+9pp)
  Risk band:                             HIGH →  MEDIUM
  Expected default risk reduction:       ~12%
  Estimated value to lender:             ₹21,600 in avoided recovery cost
  ROI on intervention:                   10.8x
────────────────────────────────────────────────────────
  Recommended: YES — escalate to Relationship Manager for approval
```

**Implementation:** Feature-delta perturbation on the trained XGBoost model. Intervention delta table maintained by the ML team and configurable in the admin panel. No model retraining required.

**Phase:** 2 | **Priority:** P1

---

### 10.2 Peer Benchmarking Engine ⭐

**What it does:** Positions each student against a filtered peer cohort (same course type + institute tier + graduation year) and surfaces a percentile rank alongside the risk score.

**How it works:** At batch scoring time, compute each student's composite feature score. Rank all students within their peer segment. Store percentile rank in the feature store alongside the risk score.

**Output on risk card:**

```
Peer Benchmark (MBA · Tier-B · 2026 Batch)
────────────────────────────────────────────
  Placement probability:   54%
  Cohort median:           67%
  Cohort top quartile:     81%
  Student percentile:      Bottom 28%

  Key gaps vs. top quartile:
  ↓ Internship Quality Index: 0.3 vs. cohort median 0.7
  ↓ Behavioral Activity Score: 31 vs. cohort median 68
```

**Value:** Makes explainability concrete and actionable. Instead of abstract SHAP values, an RM can tell a student: "You are in the bottom 28% of your cohort — specifically because of low internship quality and low job-portal activity." Highly defensible to compliance teams.

**Phase:** 1 | **Priority:** P1

---

### 10.3 Dynamic Employability Heatmap ⭐

**What it does:** A standalone lender-facing analytics panel showing real-time job demand by geography and field, allowing lenders to understand portfolio concentration risk in sectors that are cooling.

**How it works:** Aggregates weekly labor market API data (NAUKRI, LinkedIn Talent Insights, MoSPI) into a normalized Demand Index per field × region cell. Displayed as a color-coded heatmap grid.

**Views available:**
- **Field × Region grid:** Software Engineering / Bangalore, MBA-Finance / Mumbai, Nursing / Germany — each cell shows demand index (0–100), trend arrow (up/flat/down), and count of PlacementIQ students exposed.
- **Portfolio Concentration Alert:** If more than 15% of a lender's portfolio is concentrated in a field × region cell with Demand Index below 30, surface a portfolio concentration warning.
- **Trend sparklines:** 12-week demand trend per cell.

**Phase:** 2 | **Priority:** P1

---

### 10.4 Alternate Career Path Engine ⭐

**What it does:** When a student's Field Demand Score is in the bottom quartile for their declared discipline, the system recommends adjacent, higher-demand roles that are compatible with their academic background — ranked by demand score in their geography.

**How it works:** Uses a curated role-adjacency mapping table (not freeform LLM generation, for reliability and explainability). Each source discipline maps to 3–6 adjacent roles. Adjacent roles are filtered by Field Demand Score in the student's geography and ranked by demand × salary compatibility.

**Example:**

```
Primary field: Mechanical Engineering (Field Demand Score: 22 / 100 — Pune)

Recommended pivots (ranked by demand in Pune):
  1. Supply Chain Analyst           Demand: 71   Salary match: 94%
  2. Quality Assurance Engineer     Demand: 68   Salary match: 88%
  3. Operations Manager (BFSI)      Demand: 61   Salary match: 79%
  4. Manufacturing Consultant       Demand: 54   Salary match: 74%
```

**NBA integration:** Adjacent role recommendations are auto-surfaced in the NBA engine when Field Demand Score < 30th percentile.

**Adjacency table scope (Phase 1):** Engineering (Mechanical, Civil, Electrical), MBA specializations, Nursing/Allied Health. Expandable via admin panel.

**Phase:** 2 | **Priority:** P1

---

### 10.5 Confidence Score & Data Quality Meter ⭐

**What it does:** Every risk score is accompanied by a confidence level and a plain-language note explaining which data gaps reduce confidence. This is critical for compliance teams and makes the product enterprise-grade.

**How it works:** The Data Completeness Score (computed in feature engineering) maps to a confidence tier. Prediction interval width from the LightGBM salary model provides a secondary signal.

**Confidence tiers:**

| Tier | Completeness | Prediction Interval | Display |
|---|---|---|---|
| **High** | ≥ 85% | ± < 20% of median | Green — "Score is based on complete data" |
| **Medium** | 65–84% | ± 20–35% of median | Amber — "Limited institute history available" |
| **Low** | < 65% | ± > 35% of median | Red — "2+ data sources missing — treat score as indicative" |

**Display on every risk card:**

```
Confidence: MEDIUM  ▓▓▓▓▓▓▒▒▒▒  64%
Missing data: Institute placement history (last update: 47 days ago)
              Behavioral signals (student has not connected job portal)
```

**Phase:** 1 | **Priority:** P0

---

### 10.6 Placement Shock Detector ⭐

**What it does:** A real-time macro-intelligence layer that monitors sector-level and geography-level hiring signal feeds. When a significant negative shift is detected (e.g., mass layoffs in IT sector), it auto-escalates all affected students in the lender's portfolio and sends a portfolio-level alert to the lender risk team.

**How it works:**
- Monitors weekly labor market API feeds and NLP-parsed news signals (layoff announcements, hiring freeze posts).
- A shock is defined as: sector hiring volume declining more than 15% week-on-week, OR a major employer in the student's target field announcing layoffs of more than 1,000 employees.
- On shock detection: Macro Climate Index for the affected segment is overridden to real-time value. All students with primary field × geography in the affected segment have their scores re-run immediately. Students whose risk band changes are surfaced in an emergency alert feed.

**Alert format:**

```
⚠️  PLACEMENT SHOCK DETECTED — May 3, 2026
Sector: Information Technology
Geography: Pune, Bengaluru
Trigger: IT hiring volume down 18% WoW; 3 major employers announced hiring freeze
──────────────────────────────────────────────────────────
Portfolio impact:
  Students re-scored:           147
  Risk band escalations:         34  (23 Medium → High, 11 Low → Medium)
  High-risk students added:      23
  Recommended action:  Assign RMs to 23 new HIGH students immediately
```

**Phase:** 2 | **Priority:** P1

---

### 10.7 Synthetic Cold-Start Institute Scoring ⭐

**What it does:** Enables the system to score students from new institutes with limited or no historical placement data, by finding the K most similar existing institutes in the database and borrowing their placement rate distributions as a proxy.

**Why it matters:** Without this, any new institute onboarding takes 6–12 months of data collection before students can be scored. Cold-start scoring allows PlacementIQ to onboard and score from day one.

**How it works:**
1. Encode the new institute using available features: NAAC/NBA grade, city tier, course mix, faculty-student ratio, fee range, recruiter sign-up intent.
2. Compute cosine similarity against all existing institutes in the database using these features.
3. Select the K=5 most similar institutes (minimum similarity threshold: 0.65).
4. Compute a weighted average of their placement rates and salary distributions as the synthetic baseline for the new institute.
5. Tag all students from cold-start institutes with a "Synthetic Baseline" flag and a lower Confidence Score ceiling (max Medium).

**Confidence override:** Students from cold-start institutes can never receive a High Confidence score until 6 months of actual outcome data is collected. This is enforced at the display layer.

**Phase:** 2 | **Priority:** P1

---

### 10.8 EMI Comfort Index ⭐

**What it does:** Computes a simple but critical ratio — predicted starting salary vs. monthly EMI obligation — to flag students who may be at repayment risk even after being placed. This catches the underemployment scenario that all current tools miss.

**Formula:**
```
EMI Comfort Ratio = predicted_salary_median (INR/month) / monthly_emi_amount (INR/month)
```

**Risk tiers:**

| Ratio | Label | Meaning | Action |
|---|---|---|---|
| ≥ 2.5 | Comfortable | Student can service EMI with significant headroom | Standard monitoring |
| 1.5–2.49 | Adequate | EMI is manageable but leaves limited savings buffer | Quarterly check-in |
| 1.0–1.49 | Tight | Most of take-home pay consumed by EMI; moderate stress risk | Monthly monitoring + salary negotiation coaching |
| < 1.0 | Underemployment Risk | Predicted salary below EMI obligation even if placed | Case manager assigned; consider EMI restructuring pre-emptively |

**Dashboard integration:** The EMI Comfort Ratio is displayed on every individual student risk card alongside the placement probability. A portfolio-level view shows the distribution of EMI Comfort Ratios across all borrowers.

**Phase:** 1 | **Priority:** P0

---

### 10.9 Batch Peer Velocity Tracker ⭐

**What it does:** Tracks the real-time placement velocity of a student's cohort (same institute + course + batch year) and surfaces urgency signals when a student is being left behind by their batch.

**How it works:** At each nightly scoring run, compute the percentage of the cohort placed to date. If cohort placement rate exceeds 35% but the individual student remains unplaced, trigger a Velocity Alert.

**Alert tiers:**

| Cohort Placed | Student Status | Alert |
|---|---|---|
| < 25% | Unplaced | Normal — early in cycle |
| 25–50% | Unplaced | Yellow — "Your batch is moving; student has not begun active search" |
| 50–75% | Unplaced | Orange — "Majority of cohort placed; student urgently needs intervention" |
| > 75% | Unplaced | Red — "Critical: student is in the lagging 25% of cohort" |

**Privacy:** Cohort placement rates are computed from anonymized, aggregated data. No individual peer's status is exposed.

**Phase:** 2 | **Priority:** P1

---

### 10.10 Offer Survival Score ⭐

**What it does:** For students who have received a job offer (and whose risk is typically considered resolved), the system scores the financial health of the hiring company to detect offer-reversal risk before it happens.

**How it works:**
- When a job offer is logged in the system (via institute placement cell update or student self-report), the hiring company is identified.
- The system fetches company health signals: recent funding round status, headcount trend (LinkedIn), layoff announcements (scraped from Tracxn/Crunchbase), Glassdoor rating trend.
- A gradient-boosted classifier scores P(offer revocation within 60 days).

**Output:**

```
Student: Rahul Sharma · Offer received: TechCorp Solutions (Apr 28, 2026)

Offer Survival Score: 31 / 100  — HIGH REVOCATION RISK
────────────────────────────────────────────────────────────
Risk signals detected:
  ✗  Headcount declined 22% in past 6 months (LinkedIn)
  ✗  Series B funding round overdue by 8 months (Tracxn)
  ✗  Glassdoor rating dropped from 4.1 → 3.2 in 90 days
  ✓  Company still posting new JDs (weak positive signal)

Recommended action: Advise student to continue job search in parallel.
```

**Phase:** 3 | **Priority:** P2

---

### 10.11 Action Completion Tracker ⭐

**What it does:** Closes the most critical loop in the NBA engine — verifying whether a student actually completed the recommended interventions, not just whether the RM sent the recommendation.

**How it works:**
- Each NBA action is assigned a completion verification method at the time of recommendation.
- Completion events are ingested via integrations with partner platforms (Coursera, LinkedIn Learning, institute LMS) or via RM manual confirmation.
- Incomplete actions after the expected completion window trigger an escalation to the RM.

**Verification methods by action type:**

| NBA Action | Verification Method |
|---|---|
| Skill-up course | Completion certificate webhook from course platform |
| Mock interview | Confirmation event from institute placement cell |
| Resume submission | Job portal activity — applications submitted count |
| Recruiter connect | Confirmation from placement cell or RM manual log |
| Case manager call | CRM event log from RM call notes |

**Dashboard view:**

```
Student: Priya Patel  ·  Risk: HIGH
NBA Actions Assigned: 3   Completed: 1   Overdue: 2

  ✓  Python Analytics Course     Completed Apr 20  (7 days ahead of schedule)
  ✗  Mock Interview × 2          Overdue by 12 days  →  Escalate to RM
  ✗  Resume submission to 5 cos  Not started         →  Send reminder
```

**Phase:** 2 | **Priority:** P1

---

### 10.12 Institute Momentum Index

**What it does:** Tracks real-time recruiter visit and offer-letter trends at each institute, providing a leading indicator of placement cell health before historical statistics reflect it.

**How it works:** Described in Section 6.2. The Momentum Ratio (30-day vs. 90-day rolling average) is updated monthly and feeds directly into the Institute Tier Score weighting.

**Use in scoring:** A Momentum Ratio below 0.6 applies a 15% downward adjustment to the Institute Tier Score for all students at that institute. A Momentum Ratio above 1.4 applies a 10% upward adjustment.

**Dashboard display:** An institute health panel in the Cohort View shows momentum ratios for all institutes in the lender's portfolio, with a ranked list of "institutes with declining momentum."

**Phase:** 2 | **Priority:** P1

---

## 11. API Specification

### 11.1 Authentication & Versioning

All APIs use JWT Bearer token authentication. Base URL: `https://api.placementiq.io/v1`. Rate limit: 1,000 requests/minute per lender tenant.

### 11.2 Core Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `POST /score/student` | POST | Single-student real-time scoring. Returns placement probabilities, risk band, salary range, EMI comfort ratio, confidence score, peer percentile, top-3 SHAP drivers, and NBA recommendations. |
| `POST /score/batch` | POST | Batch scoring for up to 1,000 students. Async; returns `job_id`. Webhook callback on completion. |
| `GET /score/{student_id}` | GET | Latest cached score for a student. Returns full score object + 90-day trend. |
| `GET /score/{student_id}/history` | GET | Full chronological score history with model version and feature snapshot per event. |
| `GET /alerts/active` | GET | All active high-risk alerts in the lender's portfolio. Filterable. |
| `POST /alerts/{id}/acknowledge` | POST | Mark alert as acknowledged + log RM action. |
| `GET /cohort/summary` | GET | Cohort-level aggregate: risk distribution, average placement probability, EMI comfort distribution, salary band distribution. |
| `POST /simulate/intervention` | POST | Intervention Simulator endpoint. Accepts student_id + intervention type; returns probability delta, cost, and ROI estimate. |
| `GET /heatmap/demand` | GET | Returns the Dynamic Employability Heatmap data grid. Filterable by field, region, and date range. |
| `GET /shocks/active` | GET | Returns all active Placement Shock Detector events and affected student counts. |
| `GET /score/{student_id}/offer-survival` | GET | Returns Offer Survival Score for a student with an active offer on record. |
| `POST /nba/{student_id}/action/complete` | POST | Mark an NBA action as completed by a student. Triggers score refresh. |
| `GET /model/metadata` | GET | Current model version, training date, feature list, and performance metrics for transparency. |
| `POST /feedback` | POST | **Reviewer Outcome Submission** — Submit actual placement outcome (placed/unplaced, actual salary, employer, delay reasons) for a student. Powers the continuous learning loop: outcomes are matched against predictions to compute accuracy metrics, trigger model retraining when drift is detected, and close the feedback loop between prediction and reality. This endpoint directly satisfies the "Reviewer outcome (for training & evaluation)" requirement. |
| `GET /health` | GET | Service health check. |

### 11.3 Sample Request/Response — POST /score/student

**Request:**
```json
{
  "student_id": "STU-2024-00891",
  "lender_id": "LND-PFIN-001",
  "academic": {
    "course_type": "MBA",
    "cgpa": 7.2,
    "semester": 4,
    "internship_months": 3,
    "employer_tier": "MNC",
    "certifications": ["CFA-L1", "Excel-Advanced"]
  },
  "institute_id": "INST-00042",
  "graduation_date": "2026-06-30",
  "loan": {
    "monthly_emi": 18000,
    "emi_start_date": "2026-09-01"
  }
}
```

**Response:**
```json
{
  "student_id": "STU-2024-00891",
  "scored_at": "2026-05-01T10:32:00Z",
  "model_version": "v2.1.0",
  "placement_probability": {
    "within_3_months": 0.52,
    "within_6_months": 0.78,
    "within_12_months": 0.91
  },
  "salary_estimate": {
    "low": 45000, "median": 62000, "high": 85000, "currency": "INR"
  },
  "emi_comfort": {
    "ratio": 3.44,
    "tier": "COMFORTABLE",
    "monthly_emi": 18000,
    "predicted_median_salary": 62000
  },
  "risk_band": "MEDIUM",
  "risk_score": 54,
  "confidence": {
    "level": "MEDIUM",
    "percentage": 71,
    "data_gaps": ["Institute placement history last updated 34 days ago"]
  },
  "peer_benchmark": {
    "cohort": "MBA · Tier-B · 2026",
    "student_percentile": 38,
    "cohort_median_probability_6m": 0.71,
    "cohort_top_quartile_probability_6m": 0.84
  },
  "risk_drivers": [
    { "rank": 1, "factor": "Institute tier below top quartile for MBA placements", "impact": "negative" },
    { "rank": 2, "factor": "Internship at MNC strengthens employability significantly", "impact": "positive" },
    { "rank": 3, "factor": "IT-sector hiring down 12% YoY in candidate's target region", "impact": "negative" }
  ],
  "next_best_action": [
    { "action": "SKILL_UP", "detail": "Python for Business Analytics — estimated +9pp placement probability", "cost_inr": 2000, "roi_estimate": "10.8x" },
    { "action": "MOCK_INTERVIEW", "detail": "2 mock interviews before graduation — estimated +6pp", "cost_inr": 0 }
  ]
}
```

### 11.4 Sample Request — POST /simulate/intervention

**Request:**
```json
{
  "student_id": "STU-2024-00891",
  "intervention": "SKILL_UP_PYTHON_ANALYTICS",
  "completion_timeline_days": 30
}
```

**Response:**
```json
{
  "student_id": "STU-2024-00891",
  "intervention": "SKILL_UP_PYTHON_ANALYTICS",
  "baseline_probability_6m": 0.78,
  "simulated_probability_6m": 0.87,
  "probability_delta": 0.09,
  "risk_band_before": "MEDIUM",
  "risk_band_after": "LOW",
  "intervention_cost_inr": 2000,
  "estimated_default_risk_reduction_pct": 12.0,
  "estimated_lender_value_inr": 21600,
  "roi": 10.8,
  "recommendation": "APPROVE"
}
```

---

## 12. Risk Classification Logic

### 12.1 Risk Band Thresholds

Risk band uses the 6-month placement probability as the primary signal, with a rules override layer:

| Risk Level | Trigger Conditions | Lender Action | Review Cadence |
|---|---|---|---|
| 🟢 LOW | Tier A/B institute · CGPA ≥ 7.5 · IQI ≥ 0.7 · Demand > 60 · EMI Comfort ≥ 2.5 | Standard monitoring | Quarterly |
| 🟡 MEDIUM | Mid-tier · moderate CGPA · limited internship · fluctuating demand · EMI Comfort 1.5–2.5 | Skill-up nudge + RM outreach | Monthly |
| 🔴 HIGH | Low-tier · CGPA < 6 · no internship · low demand · adverse macro · EMI Comfort < 1.5 | Case manager assigned + EMI grace review | Weekly |

### 12.2 Hard Override Rules (Auto HIGH Classification)

The following conditions override the model output and force HIGH classification:

- Institute 12-month placement rate below 40% (historical).
- Student has zero internship experience AND field demand index in bottom quartile nationally.
- Macro Climate Index drops below 0.3 (severe labor market contraction in target sector).
- Student CGPA below 5.0 AND institute tier score below 3.
- EMI Comfort Ratio below 1.0 (predicted salary cannot service EMI even if placed).
- Institute Momentum Ratio below 0.5 (severe placement cell decline).
- Placement Shock Detector active for student's primary field × geography AND student is currently unplaced.

All rule-driven overrides are labeled as "Policy Override" in the audit trail and dashboard to maintain transparency for compliance review.

---

## 13. Next-Best-Action (NBA) Engine

### 13.1 NBA Decision Logic

| Trigger Condition | NBA Action | Mechanism | Expected Impact |
|---|---|---|---|
| IQI < 0.3 OR no internship | SKILL_UP + Internship Referral | Link to lender-partnered courses + placement cell alert | +8–12pp placement probability |
| Field Demand Score < 30th percentile | ALTERNATE_FIELD_EXPLORE | Alternate Career Path Engine surfaces adjacent roles | +5–10pp |
| Behavioral Activity Score < 40 | JOB_SEARCH_COACHING | Career counsellor nudge + resume workshop referral | +7pp |
| CGPA < 6.0 + Tier-C/D institute | MOCK_INTERVIEW + Resume Review | 2 mock interviews; resume scoring tool | +6pp |
| Risk band transitions to HIGH | CASE_MANAGER_ASSIGNMENT | Dedicated RM assigned + check-in call scheduled | Prevents delinquency in ~35% of cases |
| P(placed ≤ 3m) < 0.30 at 1 month post-graduation | EMI_GRACE_REVIEW | Flag for EMI deferral review by credit team | Reduces forced default rate |
| Peer Velocity Alert (cohort > 50% placed, student unplaced) | URGENCY_ESCALATION | RM notified; intervention timeline accelerated | Reduces cohort-lagging tail |
| Offer Survival Score < 40 | PARALLEL_SEARCH_ADVISORY | Advise student to continue active search in parallel | Prevents offer-revocation default |
| EMI Comfort Ratio 1.0–1.49 | SALARY_NEGOTIATION_COACHING | Connect student to salary negotiation resources | Increases comfort ratio at offer stage |
| Action Completion Tracker shows overdue action | COMPLETION_ESCALATION | RM notified; automated reminder to student via lender app | Closes NBA-to-outcome loop |

---

## 14. Non-Functional Requirements

| Category | Requirement | Specification |
|---|---|---|
| **Performance** | API latency (real-time) | p95 ≤ 1,200 ms; p99 ≤ 2,500 ms under 500 concurrent requests |
| **Performance** | Batch throughput | 10,000 records in ≤ 30 minutes (nightly batch window) |
| **Performance** | Intervention Simulator | p95 ≤ 800 ms (pre-computed feature delta table, no model retraining) |
| **Availability** | Uptime SLA | 99.5% monthly; planned maintenance within 2-hour weekly window |
| **Scalability** | Multi-tenancy | ≥ 20 lender tenants with strict data isolation (tenant-scoped encryption) |
| **Security** | Data encryption | AES-256 at rest; TLS 1.3 in transit; field-level encryption for PII |
| **Security** | Access control | RBAC with 5 roles: Analyst, RM, Admin, Compliance Officer, ML Engineer. MFA mandatory for Admin. |
| **Explainability** | Score transparency | Every inference stores: feature inputs, SHAP values, confidence score, model version, timestamp. Retention: 7 years. |
| **Fairness** | Bias monitoring | Monthly demographic parity checks across gender, geography, and course type. Alert if disparity > 10%. |
| **Observability** | Monitoring | Prometheus + Grafana for latency, error rate, model drift (PSI), alert volume, action completion rates. |
| **Shock Response** | Placement Shock Detector SLA | Macro shock detected → portfolio re-scoring completed within 2 hours. |

---

## 15. Success Metrics & KPIs

| KPI | Baseline Target | Stretch Target | Measurement |
|---|---|---|---|
| Placement prediction accuracy (3m) | ≥ 75% F1 | ≥ 85% F1 | Monthly |
| Placement prediction accuracy (6m) | ≥ 80% F1 | ≥ 88% F1 | Monthly |
| Salary estimation MAPE | ≤ 18% | ≤ 10% | Monthly |
| High-risk alert precision | ≥ 70% | ≥ 85% | Monthly |
| EMI Comfort Index accuracy (vs. actual ratio post-placement) | ≤ 20% MAPE | ≤ 12% MAPE | Quarterly |
| Offer Survival Score precision (offer revocation) | ≥ 65% | ≥ 80% | Quarterly |
| Intervention Simulator → action completion rate | ≥ 40% of recommended actions completed | ≥ 65% | Monthly |
| Cold-start institute scoring accuracy (vs. actuals after 6m) | ≤ 15% MAE | ≤ 8% MAE | At 6-month mark |
| Lender dashboard daily active usage | ≥ 60% of enrolled users | ≥ 80% | Weekly |
| API p95 latency | ≤ 1,200 ms | ≤ 500 ms | Continuous |
| Model drift (PSI) | PSI < 0.25 | PSI < 0.15 | Weekly |
| Early delinquency reduction (6-month rolling) | 10% relative reduction | 25% reduction | Quarterly |

---

## 16. Compliance, Privacy & Ethics

### 16.1 Data Privacy

- System collects only data necessary for employability modeling. No biometric, caste, religion, or political data is ingested at any layer.
- Student PII is pseudonymized at the feature store layer; raw identifiers stored only in the encrypted source database with access limited to DBA and Compliance Officer.
- Offer Survival Score uses company-level public signals only — no employee personal data.
- Peer Benchmarking Engine uses anonymized cohort aggregates — no individual peer's status is exposed.
- Data retention: raw data 3 years post-loan closure; model outputs and audit logs 7 years per RBI guidelines.
- Student consent for data use must be captured at loan origination via the lender's process. PlacementIQ does not manage consent directly.

### 16.2 Model Fairness & Ethics

- Protected attributes (gender, religion, caste, region of birth) are not used as model features, directly or as proxies.
- Monthly fairness audits: demographic parity and equal opportunity metrics computed across gender, geography, and course type.
- Bias remediation SLA: 30 days from detection to corrective model update.
- Cold-start institute scoring must not systematically disadvantage students from new or smaller institutes. Cold-start accuracy is tracked separately and reported quarterly.
- All model outputs are advisory. Final credit or support decisions require human-in-the-loop sign-off. This constraint is enforced at the API layer — the system has no endpoint that directly modifies a loan record.

### 16.3 Regulatory Alignment

- RBI Guidelines on Fair Lending Practices — risk scores must be explainable and non-discriminatory.
- IT Act 2000 & DPDP Act 2023 (India) — data localization, consent, and breach notification requirements apply.
- Every risk band assignment (model-driven or rule-driven) produces a human-readable summary. Rule-driven overrides are labeled "Policy Override" in the audit trail.
- IRDAI / NHB guidelines apply if the system is extended to insurance-linked or housing loan products in future phases.

---

## 17. Implementation Roadmap

| Phase | Duration | Key Deliverables | Success Gate |
|---|---|---|---|
| **Phase 0 — Discovery** | Weeks 1–3 | Stakeholder interviews, data audit, institute onboarding contracts, infra provisioning, labor market API procurement | Data pipeline POC live; at least 3 institute data-sharing agreements signed |
| **Phase 1 — MVP Build** | Weeks 4–12 | Feature engineering pipeline, XGBoost + LightGBM models, SHAP + Confidence Score, EMI Comfort Index, REST API v1, lender dashboard alpha (individual + cohort views), Peer Benchmarking Engine | 75% F1 on held-out test set; 100 students scored end-to-end |
| **Phase 2 — Pilot & Differentiators** | Weeks 13–20 | Intervention Simulator + ROI Predictor, Alternate Career Path Engine, Placement Shock Detector, Dynamic Employability Heatmap, Action Completion Tracker, Institute Momentum Index, Cold-Start Scoring, NBA v2, alert system v1 | 3 pilot lenders onboarded; lender NPS > 7; all differentiator features demo-ready |
| **Phase 3 — Scale** | Weeks 21–28 | Multi-institute rollout, Offer Survival Score, Batch Peer Velocity Tracker, real-time signal integration, compliance audit, SLA hardening | 500+ students scored; p95 < 1.2s; bias audit passed |
| **Phase 4 — Optimize** | Ongoing | A/B testing on NBA actions, model retraining cadence, reporting suite, student-facing nudges (Phase 4), partner integrations | Delinquency KPI achieved; 10%+ reduction in 6-month rolling delinquency |

---

## 18. Open Questions & Assumptions

### 18.1 Open Questions

- **OQ-01 (Resolved by Cold-Start):** Minimum acceptable historical dataset for a new institute — solved by KNN cold-start scoring, which requires only structural institute metadata, not placement history.
- **OQ-02:** Should salary estimates be shown in absolute terms or as a percentile band relative to the institute's historic range? Recommendation: show both — absolute for EMI Comfort calculation, percentile for explainability.
- **OQ-03:** Can students opt in to see their own risk scores via the lender's mobile app in Phase 2? What consent and UX guardrails are required? (Deferred to Phase 4.)
- **OQ-04:** How should the model handle students who pursue higher education (PG after UG) instead of employment? Recommendation: flag as "Further Studies" status; exclude from repayment risk scoring for 24 months; re-score 3 months before PG graduation.
- **OQ-05:** Fallback scoring logic when an institute has not shared data for more than 60 days — use last-known institute tier with a "Data Stale" flag and force Confidence Score to Low.
- **OQ-06 (NEW):** What is the minimum company data availability threshold for the Offer Survival Score? If a company has no Tracxn/Crunchbase presence (small private employer), the Offer Survival Score should default to "Insufficient Data" rather than a false confidence score.
- **OQ-07 (NEW):** For the Alternate Career Path Engine, should adjacent role recommendations be filtered by the student's geography, or should relocation be suggested? Phase 1: geography-filtered only. Phase 2: include relocation options with demand index for target city.

### 18.2 Assumptions

- Lenders will provide historical loan performance data to close the feedback loop between placement outcomes and repayment behavior.
- Institute partners will update placement progress data at minimum monthly; students who cannot be scored due to missing data are flagged as "Unscored" rather than assigned a default risk band.
- The MVP covers Engineering, MBA, and Nursing as initial course types; additional program types added iteratively.
- Intervention cost estimates in the ROI Predictor are maintained as a configurable table by the lender admin; PlacementIQ does not source or guarantee course pricing.
- Employer health signals for the Offer Survival Score are sourced from public data only; no proprietary employer data is required.

---

## 19. Feature Summary Matrix

| Feature | Category | Phase | Priority | Uniqueness |
|---|---|---|---|---|
| Placement Timeline Score (3m/6m/12m) | Core | 1 | P0 | Baseline |
| Risk Band Classification | Core | 1 | P0 | Baseline |
| Salary Range Estimation | Core | 1 | P0 | Baseline |
| Explainability Narrative (SHAP) | Core | 1 | P0 | Baseline |
| Early Alert Engine | Core | 1 | P0 | Baseline |
| NBA Recommendations | Core | 2 | P1 | Baseline |
| Lender Dashboard (Individual + Cohort) | Core | 1 | P0 | Baseline |
| Bulk Scoring API | Core | 1 | P1 | Baseline |
| Model Drift Monitoring | Core | 2 | P1 | Baseline |
| Audit Trail & Explainability Report | Core | 2 | P1 | Baseline |
| **EMI Comfort Index** | Differentiator | 1 | P0 | ⭐⭐⭐ Novel |
| **Confidence Score & Data Quality Meter** | Differentiator | 1 | P0 | ⭐⭐ |
| **Peer Benchmarking Engine** | Differentiator | 1 | P1 | ⭐⭐ |
| **Intervention Simulator + ROI Predictor** | Differentiator | 2 | P1 | ⭐⭐⭐ Novel |
| **Dynamic Employability Heatmap** | Differentiator | 2 | P1 | ⭐⭐ |
| **Alternate Career Path Engine** | Differentiator | 2 | P1 | ⭐⭐ |
| **Placement Shock Detector** | Differentiator | 2 | P1 | ⭐⭐⭐ Novel |
| **Action Completion Tracker** | Differentiator | 2 | P1 | ⭐⭐ |
| **Institute Momentum Index** | Differentiator | 2 | P1 | ⭐⭐ |
| **Batch Peer Velocity Tracker** | Differentiator | 2 | P1 | ⭐⭐ |
| **Synthetic Cold-Start Institute Scoring** | Differentiator | 2 | P1 | ⭐⭐⭐ Novel |
| **Offer Survival Score** | Differentiator | 3 | P2 | ⭐⭐⭐ Novel |

---

## 20. Glossary

| Term | Definition |
|---|---|
| **PlacementIQ** | The AI Placement Risk Modeling System described in this PRD. |
| **Placement Timeline Score** | Probability (0–100%) that a student will be placed within 3, 6, or 12 months of graduation. |
| **Risk Band** | Categorical classification (Low / Medium / High) derived from placement probability and override rules. |
| **EMI Comfort Index** | Ratio of predicted starting salary to monthly EMI obligation. Flags underemployment risk. |
| **Offer Survival Score** | Probability that a student's job offer will not be revoked, based on employer financial health signals. |
| **Intervention Simulator** | Interactive tool showing the probability delta, cost, and lender ROI of specific student interventions. |
| **Placement Shock Detector** | Real-time macro alert system that detects sector-level hiring downturns and auto-escalates affected portfolio segments. |
| **Institute Momentum Index** | Rolling 30-day vs. 90-day recruiter visit and offer trend at each institute, used as a leading indicator. |
| **Batch Peer Velocity** | Rate at which a student's cohort is securing placements, used to generate urgency-tier alerts. |
| **Cold-Start Scoring** | KNN-based synthetic scoring for new institutes with limited historical data. |
| **Action Completion Tracker** | System that verifies whether students have completed NBA-recommended interventions. |
| **Peer Benchmarking Engine** | Cohort percentile ranking system positioning a student against similar peers on composite feature score. |
| **IQI** | Internship Quality Index — composite of internship duration, employer tier, and recency. |
| **SHAP** | SHapley Additive exPlanations — game-theory-based method for explaining individual model predictions. |
| **PSI** | Population Stability Index — detects shifts in feature distribution signaling model drift. |
| **NBA** | Next-Best-Action — rule-driven and ROI-quantified recommendations for lenders to improve placement outcomes. |
| **Confidence Score** | Prediction reliability indicator derived from data completeness and model prediction interval width. |
| **MAPE** | Mean Absolute Percentage Error — primary metric for salary estimation accuracy. |
| **AUC-ROC** | Area Under the Receiver Operating Characteristic Curve — measures classification discriminatory power. |
| **EMI** | Equated Monthly Installment — fixed monthly repayment amount due from a loan borrower. |
| **Champion/Challenger** | Model deployment strategy comparing a new candidate model against the production model in shadow mode. |

---

*Document Classification: Internal — Hackathon Submission Build*
*Team: Git Pushy — TenzorX 2026, Poonawalla Fincorp National AI Hackathon*
*Version 2.0 — May 2026*
*For questions or amendments, contact the Git Pushy product team.*
