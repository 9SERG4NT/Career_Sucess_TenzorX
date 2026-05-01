# PlacementIQ — Agentic AI Risk Platform

PlacementIQ is an intelligent risk assessment platform for education loans. It utilizes a hybrid architecture: an **ML Scoring Engine** (XGBoost + LightGBM) for fast, deterministic baseline scoring, orchestrated by a **Multi-Agent AI System** that adds deep contextual reasoning, intervention planning, and market intelligence.

---

## 🤖 The Agentic AI Architecture

The backend has been upgraded from static rule-based tables to a dynamic, LLM-powered Multi-Agent system. 

The system utilizes an **Orchestrator** pattern. When a student is scored, the orchestrator first runs the fast ML models to generate base probabilities and SHAP (SHapley Additive exPlanations) values. It then delegates this context to parallel AI agents who use a suite of registered tools (fetching live market data, EMI calculations, cost tables) to reason about the student's specific situation.

### Multi-Provider Support
The system is provider-agnostic. By changing a single variable in `.env`, the entire agentic pipeline can seamlessly switch between:
- **Groq** (Fastest inference, using `llama-3.3-70b-versatile`)
- **Anthropic** (Best-in-class tool use, using `claude-sonnet-3.5`)
- **OpenRouter** (Aggregator for Claude/Llama/Gemini)
- **OpenAI** (`gpt-4o`)

---

## 🧠 The AI Agents

The `backend/agents/` directory houses 5 specialized agents, each replacing a formerly static or hardcoded system:

1. **NBA (Next-Best-Action) Agent** (`nba_agent.py`)
   * **Replaces:** Static intervention rule tables.
   * **Role:** Analyzes a student's specific risk drivers (via SHAP) and financial urgency to recommend the highest-ROI interventions.
   * **Tools Used:** `get_shap_drivers`, `get_emi_data`, `get_intervention_cost_table`.

2. **Explainability Agent** (`explainability_agent.py`)
   * **Replaces:** Hardcoded NLG (Natural Language Generation) template strings.
   * **Role:** Translates raw ML outputs and SHAP values into concise, human-readable narratives comparing the student against their peer cohort.
   * **Tools Used:** `get_shap_drivers`, `get_peer_cohort_stats`.

3. **Market Intelligence Agent** (`market_agent.py`)
   * **Replaces:** Hardcoded Week-over-Week (WoW) drop thresholds.
   * **Role:** Detects placement shocks by reasoning about live labor market data, distinguishing seasonal dips from structural industry declines.
   * **Tools Used:** `get_labor_market_data`.

4. **Career Path Agent** (`career_path_agent.py`)
   * **Replaces:** Static role-adjacency mapping tables.
   * **Role:** Recommends alternative career pivots when a student's primary field faces low demand, weighing the skill overlap against live regional demand.
   * **Tools Used:** `get_adjacent_fields`, `get_labor_market_data`.

5. **Offer Survival Agent** (`offer_survival_agent.py`)
   * **Replaces:** Secondary gradient boosted classifiers.
   * **Role:** Scores the probability that an extended job offer will NOT be revoked within 60 days by assessing the hiring company's financial health signals.
   * **Tools Used:** `get_company_health_signals`.

---

## 🛠️ Tool Registry & Caching

Agents interact with the system via `backend/agents/tools.py`. This file acts as the boundary between LLM reasoning and system data. 

To prevent LLM rate limiting (429 errors) and reduce latency, the tool executor implements an **in-memory caching layer**. If multiple agents request identical data (e.g., querying labor market data for "Engineering in Pune" during a portfolio scan), the orchestrator instantly returns the cached result rather than triggering redundant external calls.

---

## 🚀 API Endpoints

The FastAPI application (`backend/main.py`) exposes the new agentic capabilities via the following endpoints:

* **`POST /api/v1/score/student`**
  * **The Full Agentic Pipeline.** Orchestrates the ML models and parallelizes the NBA and Explainability agents to return a deeply enriched risk profile.
* **`POST /api/v1/score/student/fast`**
  * **ML-Only.** Bypasses the agents entirely for bulk portfolio scoring or latency-critical operations (~50ms).
* **`GET /api/v1/student/{student_id}/career-paths`**
  * Triggers the Career Path Agent to generate pivot recommendations based on the student's profile.
* **`GET /api/v1/student/{student_id}/offer-survival`**
  * Triggers the Offer Survival Agent to evaluate a specific hiring company.
* **`GET /api/v1/shocks/active`**
  * Triggers the Market Intelligence Agent to scan all active portfolio segments (Course + Region) in parallel using a `ThreadPoolExecutor` to detect incoming placement shocks.

---

## ⚙️ Running the Backend

1. **Setup Virtual Environment:**
   ```bash
   cd backend
   python -m venv venv
   .\venv\Scripts\activate  # Windows
   ```

2. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   Copy `.env.example` to `.env` and add your preferred provider API key:
   ```env
   PROVIDER=groq
   GROQ_API_KEY=gsk_your_key_here
   ```

4. **Start the Server:**
   ```bash
   python main.py
   ```
   *The server will run on `http://localhost:8001`.*