import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Target, MessageSquare, TrendingDown, Map, Shield, Activity, Brain, User, Cpu, Workflow, FileJson, Check, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../App';

// ── Pipeline stages — keyed so we can drive the animation deterministically ─
const PIPELINE_STAGES = [
  { id: 'profile',  label: 'Fetch profile',           icon: User,     hint: 'GET /api/v1/student/:id'         },
  { id: 'ml',       label: 'ML scoring',              icon: Cpu,      hint: 'XGBoost + LightGBM + SHAP'       },
  { id: 'agents',   label: 'Agents (parallel)',       icon: Workflow, hint: 'NBA · Explainability'            },
  { id: 'response', label: 'Assemble JSON',           icon: FileJson, hint: 'Merged ML + reasoning'           },
];

function StageNode({ stage, state, index }) {
  const Icon = stage.icon;
  const isActive = state === 'active';
  const isDone   = state === 'done';
  const isError  = state === 'error';

  return (
    <div className="pipeline-node" data-state={state}>
      <motion.div
        className="pipeline-node-dot"
        initial={false}
        animate={{
          scale:   isActive ? [1, 1.08, 1] : 1,
          opacity: state === 'idle' ? 0.35 : 1,
        }}
        transition={{
          scale:   isActive ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.25 },
          opacity: { duration: 0.25 },
        }}
      >
        {isDone  ? <Check size={14} /> :
         isError ? <AlertTriangle size={14} /> :
                   <Icon size={14} />}
      </motion.div>
      <div className="pipeline-node-meta">
        <div className="pipeline-node-step">№ 0{index + 1}</div>
        <div className="pipeline-node-label">{stage.label}</div>
        <div className="pipeline-node-hint">{stage.hint}</div>
      </div>
    </div>
  );
}

function PipelineTracker({ currentStage, hasError }) {
  // Map currentStage id → which stages are done / active
  const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === currentStage);
  const isComplete = currentStage === 'done';

  const getState = (idx) => {
    if (hasError && idx === currentIdx) return 'error';
    if (isComplete) return 'done';
    if (idx <  currentIdx) return 'done';
    if (idx === currentIdx) return 'active';
    return 'idle';
  };

  // Progress bar width — 0 at start, 100% when done
  const progressPct = isComplete
    ? 100
    : hasError
      ? (currentIdx / (PIPELINE_STAGES.length - 1)) * 100
      : Math.max(0, (currentIdx / (PIPELINE_STAGES.length - 1)) * 100);

  return (
    <div className="pipeline-tracker">
      <div className="pipeline-rail">
        <motion.div
          className="pipeline-rail-fill"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
          style={{ background: hasError ? 'var(--risk-high)' : 'var(--signal)' }}
        />
      </div>
      <div className="pipeline-nodes">
        {PIPELINE_STAGES.map((s, i) => (
          <StageNode key={s.id} stage={s} state={getState(i)} index={i} />
        ))}
      </div>
    </div>
  );
}

function AgentCard({ title, desc, icon: Icon, llmLabel, configured }) {
  return (
    <div className="agent-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color="var(--accent-purple)" />
        </div>
        <span className={`badge ${configured ? 'badge-low' : 'badge-medium'}`} style={{ fontSize: '0.7rem' }}>
          {configured ? 'Active' : 'Key missing'}
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', minHeight: '35px' }}>{desc}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '0.72rem' }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{llmLabel}</span>
        <span style={{ color: 'var(--text-muted)' }}>live</span>
      </div>
    </div>
  );
}

function ResultView({ data, llmLabel }) {
  const [showRaw, setShowRaw] = useState(false);

  if (data.error) {
    return (
      <div className="result-error">
        <AlertTriangle size={14} /> {data.error}
      </div>
    );
  }

  const risk     = data.risk_band || 'UNKNOWN';
  const riskCls  = { HIGH: 'badge-high', MEDIUM: 'badge-medium', LOW: 'badge-low' }[risk] || 'badge-medium';
  const probs    = data.placement_probability || {};
  const salary   = data.salary_estimate || {};
  const peer     = data.peer_benchmark || {};
  const emi      = data.emi_comfort || {};
  const explain  = data.agentic_explainability || {};
  const nba      = data.agentic_nba || {};

  const pct  = (v) => v != null ? `${Math.round(v * 100)}%` : '—';
  const lakh = (v) => v != null ? `₹${(v / 100000).toFixed(1)}L` : '—';

  return (
    <div className="result-view">
      {/* Risk headline + LLM tag */}
      <div className="result-header">
        <span className={`badge ${riskCls}`}>{risk} RISK</span>
        <span className="result-student-id">{data.student_id}</span>
        <span className="result-score-chip">Score {data.risk_score ?? '—'}/100</span>
        <span className="result-llm-badge" style={{ marginLeft: 'auto' }}>
          <Brain size={11} /> {llmLabel}
        </span>
      </div>

      {/* Placement probability */}
      <div className="result-section">
        <div className="result-label">Placement Probability</div>
        <div className="prob-row">
          {[['3 months', probs.within_3_months], ['6 months', probs.within_6_months], ['12 months', probs.within_12_months]].map(([label, val]) => (
            <div key={label} className="prob-cell">
              <div className="prob-value">{pct(val)}</div>
              <div className="prob-bar"><div className="prob-bar-fill" style={{ width: `${(val || 0) * 100}%` }} /></div>
              <div className="prob-label">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Salary · Peer · EMI */}
      <div className="result-meta-grid">
        <div className="result-meta-cell">
          <div className="result-label">Salary Estimate</div>
          <div className="result-meta-value">{lakh(salary.median)}</div>
          <div className="result-meta-sub">{lakh(salary.low)} – {lakh(salary.high)} range</div>
        </div>
        <div className="result-meta-cell">
          <div className="result-label">Peer Percentile</div>
          <div className="result-meta-value">{peer.student_percentile != null ? `${peer.student_percentile}th` : '—'}</div>
          <div className="result-meta-sub">{peer.percentile_label || peer.cohort || '—'}</div>
        </div>
        <div className="result-meta-cell">
          <div className="result-label">EMI Comfort</div>
          <div className="result-meta-value">{emi.tier || '—'}</div>
          <div className="result-meta-sub">Ratio {emi.ratio?.toFixed(1) ?? '—'}×</div>
        </div>
      </div>

      {/* AI Explainability */}
      {(explain.summary || explain.positive_factors?.length || explain.negative_factors?.length) && (
        <div className="result-section">
          <div className="result-label"><MessageSquare size={12} /> AI Assessment</div>
          {explain.summary && <p className="result-narrative">{explain.summary}</p>}
          {(explain.positive_factors?.length > 0 || explain.negative_factors?.length > 0) && (
            <div className="result-factors">
              {explain.positive_factors?.length > 0 && (
                <div>
                  <div className="factor-heading factor-pos">Strengths</div>
                  {explain.positive_factors.map((f, i) => <div key={i} className="result-factor result-factor-pos">+ {f}</div>)}
                </div>
              )}
              {explain.negative_factors?.length > 0 && (
                <div>
                  <div className="factor-heading factor-neg">Risk Drivers</div>
                  {explain.negative_factors.map((f, i) => <div key={i} className="result-factor result-factor-neg">– {f}</div>)}
                </div>
              )}
            </div>
          )}
          {explain.urgency_note && (
            <div className="result-urgency"><AlertTriangle size={13} /> {explain.urgency_note}</div>
          )}
        </div>
      )}

      {/* NBA Recommendations */}
      {(nba.reasoning || nba.actions?.length > 0) && (
        <div className="result-section">
          <div className="result-label"><Target size={12} /> Recommended Actions</div>
          {nba.reasoning && <p className="result-narrative">{nba.reasoning}</p>}
          {nba.actions?.map((a, i) => (
            <div key={i} className="nba-action">
              <div className="nba-rank">#{i + 1}</div>
              <div className="nba-body">
                <div className="nba-text">{a.action}</div>
                <div className="nba-meta">
                  {a.cost_inr != null && <span>Cost ₹{a.cost_inr.toLocaleString('en-IN')}</span>}
                  {a.roi_label && <span className="nba-roi">ROI {a.roi_label}</span>}
                </div>
              </div>
              {a.priority && (
                <span className={`badge badge-${a.priority === 'HIGH' ? 'high' : a.priority === 'LOW' ? 'low' : 'medium'}`} style={{ fontSize: '0.68rem' }}>
                  {a.priority}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Raw JSON toggle */}
      <button className="result-raw-toggle" onClick={() => setShowRaw(v => !v)}>
        {showRaw ? 'Hide' : 'Show'} raw JSON
      </button>
      {showRaw && (
        <div className="json-viewer"><pre style={{ margin: 0 }}>{JSON.stringify(data, null, 2)}</pre></div>
      )}
    </div>
  );
}

function AgenticInsights() {
  const [studentId, setStudentId] = useState('STU-2026-00001');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  // stage: null | 'profile' | 'ml' | 'agents' | 'response' | 'done'
  const [stage, setStage] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/health`, { timeout: 4_000 })
      .then(r => setHealth(r.data))
      .catch(() => setHealth({ llm: { provider: null, model: null, configured: false } }));
  }, []);

  // Compact "provider · short-model" string for the agent card footer
  const llmLabel = (() => {
    const llm = health?.llm;
    if (!llm || !llm.provider) return 'LLM · unknown';
    const shortModel = (llm.model || '').split('/').pop() || '—';
    return `${llm.provider} · ${shortModel}`;
  })();
  const llmConfigured = !!health?.llm?.configured;

  const runDemo = async () => {
    if (!studentId) return;
    const t0 = performance.now();
    setRunning(true);
    setResult(null);
    setHasError(false);
    setElapsedMs(null);
    setStage('profile');

    try {
      const profileRes = await axios.get(`${API_BASE}/api/v1/student/${studentId}`, { timeout: 8_000 });
      if (!profileRes.data || !profileRes.data.profile) throw new Error('Student not found');
      const profile = profileRes.data.profile;

      const reqBody = {
        student_id: profile.student_id,
        course_type: profile.course_type || 'Engineering',
        institute_tier: profile.institute_tier || 'A',
        region: profile.region || 'Bengaluru',
        cgpa: profile.cgpa || 7.5,
        internship_months: profile.internship_months || 3,
        employer_tier: profile.employer_tier || 'Startup',
        iqi: profile.iqi || 0.5,
        behavioral_activity_score: profile.behavioral_activity_score || 65,
        field_demand_score: profile.field_demand_score || 80,
        macro_climate_index: profile.macro_climate_index || 0.7,
        monthly_emi: profile.monthly_emi || 15000,
      };

      // ML stage briefly visible before the request actually returns
      setStage('ml');
      await new Promise(r => setTimeout(r, 350));
      setStage('agents');

      // 60s upper bound — server caps each agent at 30s × 2 in parallel, plus ML overhead.
      const scoreRes = await axios.post(`${API_BASE}/api/v1/score/student`, reqBody, { timeout: 60_000 });

      setStage('response');
      await new Promise(r => setTimeout(r, 220));
      setResult(scoreRes.data);
      setStage('done');
      setElapsedMs(Math.round(performance.now() - t0));
    } catch (e) {
      setHasError(true);
      setResult({ error: e.response?.data?.detail || e.message || 'Simulation failed' });
      setElapsedMs(Math.round(performance.now() - t0));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Brain size={24} color="var(--accent-purple)" /> Agentic AI Command Center
        </h1>
        <p>Real-time view of AI agent activity powering PlacementIQ's risk intelligence</p>
      </div>

      {/* Agents Grid */}
      <div className="grid-5" style={{ marginBottom: '2.5rem' }}>
        <AgentCard title="NBA Agent" desc="Recommends cost-aware, ROI-ranked interventions" icon={Target} llmLabel={llmLabel} configured={llmConfigured} />
        <AgentCard title="Explainability Agent" desc="Generates human-readable risk narratives from SHAP" icon={MessageSquare} llmLabel={llmLabel} configured={llmConfigured} />
        <AgentCard title="Market Intel Agent" desc="Detects hiring shocks and sector disruptions" icon={TrendingDown} llmLabel={llmLabel} configured={llmConfigured} />
        <AgentCard title="Career Path Agent" desc="Finds demand-aware career pivots for at-risk students" icon={Map} llmLabel={llmLabel} configured={llmConfigured} />
        <AgentCard title="Offer Survival Agent" desc="Scores P(offer not revoked) using employer signals" icon={Shield} llmLabel={llmLabel} configured={llmConfigured} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Live Demo — horizontal layout */}
        <div className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 420px', minWidth: 260 }}>
            <div className="card-title" style={{ color: 'var(--accent-purple)' }}><Activity size={15} /> Live Agent Demo</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Trigger a full pipeline execution for a specific student. This orchestrates the ML models first, then runs the agents to enrich the output.
            </p>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
              <input
                type="text"
                className="select-input"
                style={{ flex: 1, minHeight: 'auto', padding: '0.5rem 0.85rem' }}
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="e.g. STU-2026-00001"
              />
              <button className="btn btn-primary" onClick={runDemo} disabled={running} style={{ whiteSpace: 'nowrap', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>
                <Brain size={14} /> {running ? 'Running Pipeline...' : 'Run Full Agentic Pipeline'}
              </button>
            </div>

            {stage && (
              <div style={{ marginBottom: '0.5rem' }}>
                <PipelineTracker currentStage={stage} hasError={hasError} />
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <AnimatePresence mode="wait">
              {(stage === 'done' || hasError) && (
                <motion.div
                  key={hasError ? 'err' : 'ok'}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
                  className="pipeline-summary"
                  data-state={hasError ? 'error' : 'done'}
                >
                  {hasError
                    ? <><AlertTriangle size={14} /> Pipeline failed{elapsedMs != null ? ` after ${elapsedMs} ms` : ''}.</>
                    : <><Check size={14} /> Pipeline complete{elapsedMs != null ? ` in ${elapsedMs} ms` : ''}.</>
                  }
                </motion.div>
              )}
            </AnimatePresence>

            {result && <ResultView data={result} llmLabel={llmLabel} />}
          </div>
        </div>

        {/* Secondary cards placed underneath in a responsive two-column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="card">
            <div className="card-title">System Architecture Flow</div>
            <div className="flow-diagram">
              <div className="flow-box">User Request</div>
              <div className="flow-arrow">→</div>
              <div className="flow-box" style={{ borderColor: 'var(--accent-primary)' }}>ML Models<br /><span style={{ fontSize: '0.7rem', fontWeight: 400 }}>XGBoost + LightGBM</span></div>
              <div className="flow-arrow">→</div>
              <div className="flow-box-agent flow-box">Agent Orchestrator</div>
              <div className="flow-arrow">→</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="flow-box-agent flow-box" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>NBA Agent</div>
                <div className="flow-box-agent flow-box" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Explainability Agent</div>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-box">JSON Response</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Agent Capabilities & Tools</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Replaces</th>
                    <th>Tools Used</th>
                    <th>Avg RT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>NBA</strong></td>
                    <td>PRD §13 rules</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_shap_drivers<br />get_emi_data<br />get_intervention_cost_table</td>
                    <td>~2-3s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Explainability</strong></td>
                    <td>NLG templates</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_shap_drivers<br />get_peer_cohort_stats</td>
                    <td>~1-2s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Market Intel</strong></td>
                    <td>Thresholds</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_labor_market_data</td>
                    <td>~1-2s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Career Path</strong></td>
                    <td>Static tables</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_adjacent_fields<br />get_labor_market_data</td>
                    <td>~2-4s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Offer Survival</strong></td>
                    <td>Gradient Boost</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_company_health_signals</td>
                    <td>~1-2s</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgenticInsights;