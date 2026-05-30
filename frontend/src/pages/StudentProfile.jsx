import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, User, Shield, Briefcase, Zap,
  CheckCircle2, AlertOctagon, Target, TrendingUp,
  Clock, ChevronRight, Activity, Play, Map, Building2, Info, Brain,
  Award, MessageSquare, FileText, Handshake, IndianRupee
} from 'lucide-react';
import { API_BASE } from '../App';

const RISK_COLOR = { LOW: 'var(--risk-low)', MEDIUM: 'var(--risk-medium)', HIGH: 'var(--risk-high)' };
const RISK_BG = { LOW: 'var(--risk-low-bg)', MEDIUM: 'var(--risk-medium-bg)', HIGH: 'var(--risk-high-bg)' };

function ProbabilityHorizon({ label, value, riskBand }) {
  const pct = Math.round(value * 100);
  const barColor = pct >= 70 ? 'var(--risk-low)' : pct >= 45 ? 'var(--risk-medium)' : 'var(--risk-high)';
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>{label}</div>
      <div style={{
        fontSize: '1.8rem', fontWeight: 700,
        color: barColor,
        textShadow: '0 1px 0 rgba(0,0,0,0.06)'
      }}>{pct}%</div>
      <div className="progress-bar-track" style={{ marginTop: '0.5rem' }}>
        <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}

function SHAPDriverItem({ driver, index }) {
  const isPositive = driver.impact_direction === 'Positive';
  const color = isPositive ? 'var(--risk-low)' : 'var(--risk-high)';
  const absVal = Math.abs(driver.shap_value || 0);
  const barWidth = Math.min(100, absVal * 800); // scale for display

  return (
    <div className="shap-item">
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
        background: isPositive ? 'var(--risk-low-bg)' : 'var(--risk-high-bg)',
        color, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.8rem'
      }}>
        {isPositive ? '+' : '−'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.2rem' }}>
          {driver.readable_name}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
          {driver.description}
        </div>
        <div className="shap-bar-track">
          <div className="shap-bar-fill" style={{ width: `${barWidth}%`, background: color }} />
        </div>
      </div>
      <div style={{ fontSize: '0.78rem', color, fontWeight: 600, flexShrink: 0, fontFamily: 'monospace' }}>
        {isPositive ? '+' : ''}{(driver.shap_value || 0).toFixed(3)}
      </div>
    </div>
  );
}

function PeerBenchmark({ peer }) {
  if (!peer) return null;
  const { student_probability, cohort_median, cohort_top_quartile, student_percentile, percentile_label, cohort } = peer;

  const pct = Math.round(student_probability * 100);
  const medPct = Math.round(cohort_median * 100);
  const tqPct = Math.round(cohort_top_quartile * 100);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
        <span>Cohort: {cohort}</span>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{percentile_label}</span>
      </div>
      <div className="peer-track">
        {/* Median marker */}
        <div className="peer-marker" style={{ left: `${medPct}%`, background: 'var(--risk-medium)' }} title={`Cohort Median: ${medPct}%`} />
        {/* Top quartile marker */}
        <div className="peer-marker" style={{ left: `${tqPct}%`, background: 'var(--risk-low)' }} title={`Top Quartile: ${tqPct}%`} />
        {/* Student fill */}
        <div className="peer-track-fill" style={{ width: `${pct}%` }} />
        {/* Student dot */}
        <div className="peer-marker" style={{ left: `${pct}%`, background: 'var(--accent-primary)', border: '2px solid var(--bg-main)', width: '16px', height: '16px' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>You: {pct}%</span>
        <span>Median: {medPct}%</span>
        <span style={{ color: 'var(--risk-low)' }}>Top 25%: {tqPct}%</span>
      </div>
      <div style={{ marginTop: '0.75rem', textAlign: 'center' }}>
        <span className={`badge ${student_percentile >= 50 ? 'badge-low' : student_percentile >= 25 ? 'badge-medium' : 'badge-high'}`}>
          {percentile_label} of cohort
        </span>
      </div>
    </div>
  );
}

function InterventionSimulator({ studentId, studentData }) {
  const [interventions, setInterventions] = useState([]);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/interventions`).then(res => {
      const opts = Object.entries(res.data).map(([name, data]) => ({ name, ...data }));
      setInterventions(opts);
      if (opts.length > 0) setSelected(opts[0].name);
    }).catch(() => {});
  }, []);

  const runSimulation = async () => {
    if (!selected) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/student/${studentId}/simulate`, {
        intervention_name: selected
      });
      setResult(res.data);
    } catch (e) {
      setResult({ error: 'Simulation failed.' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Simulate a specific intervention and see its predicted impact on placement probability and ROI for the lender.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <select className="select-input" value={selected} onChange={e => setSelected(e.target.value)}>
          {interventions.map(i => (
            <option key={i.name} value={i.name}>{i.name} {i.cost_inr > 0 ? `(₹${i.cost_inr.toLocaleString()})` : '(Free)'}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={runSimulation} disabled={running} style={{ whiteSpace: 'nowrap' }}>
          <Play size={14} />
          {running ? 'Running...' : 'Simulate'}
        </button>
      </div>

      {result && !result.error && (
        <div style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', background: result.recommended ? 'rgba(16,185,129,0.07)' : 'rgba(245,158,11,0.07)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem' }}>{result.intervention}</strong>
              <span className={`badge ${result.recommended ? 'badge-low' : 'badge-medium'}`}>
                {result.recommended ? '✓ Recommended' : '~ Marginal'}
              </span>
            </div>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {[
              { label: 'Probability', val: `${Math.round(result.probability_before * 100)}% → ${Math.round(result.probability_after * 100)}%`, highlight: result.probability_delta_pp > 0 ? 'var(--risk-low)' : 'var(--risk-high)' },
              { label: 'Delta', val: `${result.probability_delta_pp > 0 ? '+' : ''}${result.probability_delta_pp}pp`, highlight: result.probability_delta_pp > 0 ? 'var(--risk-low)' : 'var(--risk-high)' },
              { label: 'Risk Band', val: `${result.risk_band_before} → ${result.risk_band_after}`, highlight: result.risk_band_after === 'LOW' ? 'var(--risk-low)' : 'var(--text-primary)' },
              { label: 'ROI', val: result.roi === 999 ? '∞' : `${result.roi}x`, highlight: 'var(--accent-primary)' }
            ].map(({ label, val, highlight }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: highlight }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0.75rem 1.25rem', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-color)', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Cost: ₹{result.cost_inr?.toLocaleString() || 0}</span>
            <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>Expected lender value: ₹{result.expected_value_inr?.toLocaleString()}</span>
          </div>
        </div>
      )}
      {result?.error && <div style={{ color: 'var(--risk-high)', fontSize: '0.875rem' }}>{result.error}</div>}
    </div>
  );
}

// ─── Career Readiness Signals — fills PRD A.5, D.2, D.3 gaps ──────────
function CareerReadinessRow({ profile }) {
  const certs = profile.skill_certifications || [];
  const certCount = profile.skill_certs_count ?? certs.length;
  const ipScore = profile.interview_progress_score ?? 0;
  const stages = profile.interview_stages_30d || {};
  const totalScheduled = profile.interviews_scheduled_30d ?? 0;
  const cleared = profile.interviews_cleared_30d ?? 0;
  const freshness = profile.resume_freshness_days ?? null;
  const freshLabel = profile.resume_last_updated_label || '—';

  const ipColor = ipScore >= 70 ? 'var(--risk-low)' : ipScore >= 40 ? 'var(--risk-medium)' : 'var(--risk-high)';
  const freshColor = (freshness ?? 999) <= 14 ? 'var(--risk-low)' : (freshness ?? 999) <= 45 ? 'var(--risk-medium)' : 'var(--risk-high)';

  return (
    <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
      {/* Skill certifications */}
      <div className="card" style={{ borderTop: '2px solid var(--navy)' }}>
        <div className="card-title"><Award size={13} /> Skill Certifications</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', marginBottom: '0.85rem' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 400,
            fontSize: '2.6rem', lineHeight: 1,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '-0.04em',
            color: 'var(--ink)',
            fontFeatureSettings: '"tnum"',
          }}>{certCount}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            held
          </span>
        </div>
        {certs.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
            No certifications on file. Recommended: 2–3 field-relevant certs.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {certs.map((c, i) => (
              <div key={i} style={{
                fontSize: '0.82rem',
                color: 'var(--ink-soft)',
                display: 'flex', alignItems: 'center', gap: '8px',
                paddingBottom: '0.35rem',
                borderBottom: i < certs.length - 1 ? '1px solid var(--rule)' : 'none',
              }}>
                <CheckCircle2 size={12} style={{ color: 'var(--risk-low)', flexShrink: 0 }} />
                <span>{c}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interview pipeline */}
      <div className="card" style={{ borderTop: `2px solid ${ipColor}` }}>
        <div className="card-title"><MessageSquare size={13} /> Interview Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 400,
            fontSize: '2.6rem', lineHeight: 1,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '-0.04em',
            color: ipColor,
            fontFeatureSettings: '"tnum"',
          }}>{ipScore}
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-sans)', marginLeft: '3px', letterSpacing: '0' }}>/100</span>
          </span>
          <span style={{
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--ink-muted)',
            fontFeatureSettings: '"tnum"',
            textAlign: 'right',
            lineHeight: 1.3,
          }}>
            <div>{totalScheduled} sched / 30d</div>
            <div>{cleared} cleared</div>
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            ['Screening', stages.screening || 0],
            ['Technical', stages.technical || 0],
            ['Final round', stages.final || 0],
            ['Offer stage', stages.offer || 0],
          ].map(([label, v]) => {
            const max = Math.max(totalScheduled, 1);
            return (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>{label}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontFeatureSettings: '"tnum"' }}>{v}</span>
                </div>
                <div className="progress-bar-track" style={{ height: '3px', marginTop: 0 }}>
                  <div className="progress-bar-fill" style={{ width: `${(v / max) * 100}%`, background: ipColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resume freshness */}
      <div className="card" style={{ borderTop: `2px solid ${freshColor}` }}>
        <div className="card-title"><FileText size={13} /> Resume Freshness</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', marginBottom: '0.55rem' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 400,
            fontSize: '2.6rem', lineHeight: 1,
            fontVariationSettings: '"opsz" 144',
            letterSpacing: '-0.04em',
            color: freshColor,
            fontFeatureSettings: '"tnum"',
          }}>{freshness ?? '—'}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            days
          </span>
        </div>
        <div style={{ fontSize: '0.86rem', color: 'var(--ink-soft)', marginBottom: '0.85rem' }}>
          Last updated <strong style={{ color: 'var(--ink)' }}>{freshLabel}</strong>
        </div>
        <div className="progress-bar-track" style={{ height: '5px' }}>
          <div className="progress-bar-fill" style={{
            width: `${Math.max(5, 100 - ((freshness ?? 60) / 120) * 100)}%`,
            background: freshColor,
          }} />
        </div>
        <div style={{
          marginTop: '0.6rem',
          fontSize: '0.7rem',
          color: 'var(--ink-faint)',
          fontStyle: 'italic',
        }}>
          {(freshness ?? 999) > 30
            ? 'Stale — flag for resume-refresh outreach.'
            : 'Within healthy window.'}
        </div>
      </div>
    </div>
  );
}

// ─── Recruiter Matches Tab — fills NBA recruiter-matches gap ──────────────
function RecruiterMatchesTab({ studentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API_BASE}/api/v1/student/${studentId}/recruiter-matches?top_n=8`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return (
    <div className="card" style={{ padding: '2rem', color: 'var(--ink-muted)' }}>
      <Activity size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem', verticalAlign: '-2px' }} />
      Computing recruiter matches…
    </div>
  );
  if (!data) return <div className="card" style={{ padding: '2rem', color: 'var(--risk-high)' }}>Failed to load recruiter matches.</div>;

  const matchColor = (pct) => pct >= 75 ? 'var(--risk-low)' : pct >= 60 ? 'var(--risk-medium)' : 'var(--risk-high)';

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Handshake size={14} /> Recruiter Matches</div>
        <span className="agentic-badge">High-Potential Match</span>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginBottom: '1.1rem', maxWidth: '64ch' }}>
        Ranked recruiter recommendations for <strong style={{ color: 'var(--ink)' }}>{data.course} · {data.region}</strong>{' '}
        — blends 30-day demand (30%), tier fit (25%), IQI eligibility (20%), interview-pipeline momentum (25%).
      </p>

      <div className="grid-2" style={{ gap: '0.85rem' }}>
        {data.matches?.map((m, i) => (
          <div key={i} style={{
            position: 'relative',
            padding: '1.1rem 1.2rem',
            background: 'var(--card-raised)',
            border: '1px solid var(--card-edge)',
            borderLeft: `3px solid ${matchColor(m.match_pct)}`,
            borderRadius: '2px',
            transition: 'border-color 0.2s, transform 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--card-edge-strong)'; e.currentTarget.style.borderLeftColor = matchColor(m.match_pct); e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--card-edge)'; e.currentTarget.style.borderLeftColor = matchColor(m.match_pct); e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div style={{ position: 'absolute', top: '0.7rem', right: '0.95rem' }}>
              <span className="serial" style={{ fontSize: '0.7rem' }}>№ {String(i + 1).padStart(2, '0')}</span>
            </div>

            <div style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '0.6rem',
              fontWeight: 700,
              letterSpacing: '0.20em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              marginBottom: '0.4rem',
            }}>
              {m.sector} · {m.tier}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.7rem' }}>
              <h4 style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 400,
                fontSize: '1.3rem',
                fontVariationSettings: '"opsz" 72',
                letterSpacing: '-0.02em',
                color: 'var(--ink)',
                margin: 0,
                lineHeight: 1.1,
                flex: 1,
              }}>{m.name}</h4>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.75rem',
                fontWeight: 400,
                fontVariationSettings: '"opsz" 96',
                letterSpacing: '-0.03em',
                color: matchColor(m.match_pct),
                fontFeatureSettings: '"tnum"',
                lineHeight: 1,
              }}>
                {Math.round(m.match_pct)}
                <span style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-sans)', marginLeft: '2px', letterSpacing: '0' }}>%</span>
              </span>
            </div>

            <div style={{
              display: 'flex', gap: '1.1rem',
              paddingBottom: '0.65rem',
              borderBottom: '1px solid var(--rule)',
              marginBottom: '0.6rem',
              fontSize: '0.78rem',
              color: 'var(--ink-muted)',
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Briefcase size={11} />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontFeatureSettings: '"tnum"' }}>{m.open_roles_30d}</span> open · 30d
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <IndianRupee size={11} />
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontFeatureSettings: '"tnum"' }}>
                  {(m.avg_offer_inr / 100000).toFixed(1)}L
                </span> avg offer
              </span>
            </div>

            <div style={{
              fontSize: '0.78rem',
              color: 'var(--ink-soft)',
              fontStyle: 'italic',
              lineHeight: 1.45,
            }}>
              {m.rationale}
            </div>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '1rem',
        paddingTop: '0.85rem',
        borderTop: '1px solid var(--rule)',
        fontSize: '0.7rem',
        color: 'var(--ink-faint)',
        fontStyle: 'italic',
      }}>
        {data.data_note}
      </div>
    </div>
  );
}

function StudentProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analysis');

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/student/${id}`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [id]);

  if (loading) return (
    <div style={{ padding: '3rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Activity size={18} style={{ animation: 'spin 1s linear infinite' }} />
      Scoring student profile...
    </div>
  );
  if (!data) return <div style={{ padding: '2rem', color: 'var(--risk-high)' }}>Student not found or scoring error.</div>;

  const { profile, analysis } = data;
  const pred = analysis.prediction;
  const insights = analysis.insights;
  const explain = analysis.explainability;
  const riskColor = RISK_COLOR[pred.risk_band];
  const riskBg = RISK_BG[pred.risk_band];
  const nba = insights.recommended_nba || [];
  const peer = insights.peer_benchmark;

  const tabs = [
    { id: 'analysis', label: 'Risk Analysis' },
    { id: 'explainability', label: 'AI Explainability' },
    { id: 'simulator', label: 'Intervention Simulator ⭐' },
    { id: 'peer', label: 'Peer Benchmark ⭐' },
    { id: 'recruiters', label: 'Recruiter Matches ⭐' },
    { id: 'career', label: 'Career Paths ⭐' },
    { id: 'offer', label: 'Offer Survival ⭐' },
  ];

  return (
    <div className="animate-fade-up">
      {/* Back */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        <ArrowLeft size={15} /> Back to Dashboard
      </Link>

      {/* Profile Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: riskBg, border: `2px solid ${riskColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={22} color={riskColor} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontFamily: 'monospace' }}>{profile.student_id}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {profile.course_type} · Institute Tier {profile.institute_tier} · {profile.region}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className={`badge badge-${pred.risk_band.toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '0.4rem 1rem' }}>
            {pred.risk_band} RISK
          </span>
          <span className="badge badge-info" style={{ fontSize: '0.78rem' }}>
            Conf: {explain.confidence.score}/100
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4 perspective-container" style={{ marginBottom: '1.75rem' }}>
        <div className="card card-sm interactive-3d-card" style={{ borderTop: `2px solid ${riskColor}` }}>
          <div className="card-title"><Zap size={13} /> 6M Probability</div>
          <div className="stat-value" style={{ color: riskColor }}>{Math.round(pred.placement_probability['6m'] * 100)}%</div>
          <div className="progress-bar-track" style={{ marginTop: '0.5rem' }}>
            <div className="progress-bar-fill" style={{ width: `${Math.round(pred.placement_probability['6m'] * 100)}%`, background: riskColor }} />
          </div>
        </div>
        <div className="card card-sm interactive-3d-card">
          <div className="card-title"><Briefcase size={13} /> Salary Estimate</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>₹{pred.salary_estimate?.median?.toLocaleString() || pred.expected_salary?.toLocaleString()}</div>
          {pred.salary_estimate && (
            <div className="stat-sub" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
              <span>Low: ₹{pred.salary_estimate.low?.toLocaleString()}</span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span>High: ₹{pred.salary_estimate.high?.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="card card-sm interactive-3d-card" style={{ borderTop: `2px solid ${insights.emi_comfort_index < 1.2 ? 'var(--risk-high)' : insights.emi_comfort_index < 2 ? 'var(--risk-medium)' : 'var(--risk-low)'}` }}>
          <div className="card-title"><Shield size={13} /> EMI Comfort Index</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {insights.emi_comfort_index === 99 ? '∞' : `${insights.emi_comfort_index}x`}
          </div>
          <div className="stat-sub">Salary / EMI ratio (target: &gt;2.0x)</div>
        </div>
        <div className="card card-sm interactive-3d-card">
          <div className="card-title"><Target size={13} /> Peer Percentile</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{peer?.student_percentile || '—'}%</div>
          <div className="stat-sub">{peer?.percentile_label || '—'}</div>
        </div>
      </div>

      {/* Tri-horizon probability */}
      <div className="card interactive-3d-card" style={{ marginBottom: '1.5rem' }}>

        <div className="card-title"><Clock size={14} /> Placement Timeline Prediction</div>
        <div style={{ display: 'flex', gap: '2rem', paddingTop: '0.5rem' }}>
          <ProbabilityHorizon label="3 Months" value={pred.placement_probability['3m']} />
          <div style={{ width: '1px', background: 'var(--border-color)' }} />
          <ProbabilityHorizon label="6 Months" value={pred.placement_probability['6m']} />
          <div style={{ width: '1px', background: 'var(--border-color)' }} />
          <ProbabilityHorizon label="12 Months" value={pred.placement_probability['12m']} />
        </div>
      </div>

      {/* Career Readiness Signals — closes PRD A.5 / D.2 / D.3 gaps */}
      <CareerReadinessRow profile={profile} />

      {/* Tab Navigation */}
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'analysis' && (
        <div className="grid-2">
          {/* NBA */}
          <div className="card">
            <div className="card-title"><CheckCircle2 size={14} /> Next-Best-Action Recommendations</div>
            {nba.map((item, i) => (
              <div key={i} className="nba-item">
                <span className={`nba-priority nba-${item.priority.toLowerCase()}`}>{item.priority}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.2rem' }}>{item.action}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>{item.description}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>📈 {item.estimated_impact}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Student Profile */}
          <div className="card">
            <div className="card-title"><User size={14} /> Student Profile Details</div>
            {[
              ['Course Type', profile.course_type],
              ['Institute Tier', `Tier ${profile.institute_tier}`],
              ['Region', profile.region],
              ['CGPA', profile.cgpa],
              ['Internship Months', profile.internship_months || 0],
              ['Employer Tier', profile.employer_tier || 'None'],
              ['IQI (Internship Quality)', (profile.iqi || 0).toFixed(3)],
              ['Behavioral Activity', `${profile.behavioral_activity_score}/100`],
              ['Field Demand Score', `${profile.field_demand_score}/100`],
              ['Macro Climate Index', profile.macro_climate_index],
              ['Monthly EMI', `₹${profile.monthly_emi?.toLocaleString()}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'explainability' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title"><AlertOctagon size={14} /> Top SHAP Drivers</div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              These are the 3 features that had the largest impact on this student's risk score, computed using SHAP (SHapley Additive exPlanations).
            </p>
            {explain.top_drivers?.map((d, i) => <SHAPDriverItem key={i} driver={d} index={i} />)}
          </div>
          <div className="card">
            <div className="card-title"><Shield size={14} /> Data Confidence</div>
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>Score: {explain.confidence.score}/100</span>
                <span className={`badge ${explain.confidence.rating === 'High' ? 'badge-low' : explain.confidence.rating === 'Medium' ? 'badge-medium' : 'badge-high'}`}>
                  {explain.confidence.rating} Confidence
                </span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${explain.confidence.score}%`, background: explain.confidence.score >= 80 ? 'var(--risk-low)' : explain.confidence.score >= 60 ? 'var(--risk-medium)' : 'var(--risk-high)' }} />
              </div>
            </div>
            {explain.confidence.data_gaps?.length > 0 ? (
              <>
                <div style={{ fontSize: '0.82rem', color: 'var(--risk-medium)', marginBottom: '0.5rem', fontWeight: 600 }}>Data Gaps Detected:</div>
                {explain.confidence.data_gaps.map((gap, i) => (
                  <div key={i} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'rgba(245,158,11,0.05)', borderRadius: '6px', marginBottom: '0.4rem', border: '1px solid rgba(245,158,11,0.15)' }}>
                    ⚠️ {gap}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: '0.82rem', color: 'var(--risk-low)' }}>✓ All key data fields populated. High confidence prediction.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'simulator' && (
        <div className="card">
          <div className="card-title"><TrendingUp size={14} /> Intervention Simulator + ROI Predictor</div>
          <InterventionSimulator studentId={id} studentData={profile} />
        </div>
      )}

      {activeTab === 'peer' && (
        <div className="card">
          <div className="card-title"><Target size={14} /> Peer Benchmarking Engine</div>
          {peer ? <PeerBenchmark peer={peer} /> : <p style={{ color: 'var(--text-secondary)' }}>No peer data available.</p>}
          <hr className="divider" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            {peer && [
              { label: 'Student Probability', val: `${Math.round(peer.student_probability * 100)}%` },
              { label: 'Cohort Median', val: `${Math.round(peer.cohort_median * 100)}%` },
              { label: 'Top Quartile', val: `${Math.round(peer.cohort_top_quartile * 100)}%` },
              { label: 'Percentile Rank', val: peer.percentile_label },
            ].map(({ label, val }) => (
              <div key={label} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{label}</div>
                <div style={{ fontWeight: 700, marginTop: '0.25rem' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'recruiters' && (
        <RecruiterMatchesTab studentId={id} />
      )}

      {activeTab === 'career' && (
        <CareerPathsTab studentId={id} />
      )}

      {activeTab === 'offer' && (
        <OfferSurvivalTab studentId={id} />
      )}
    </div>
  );
}

// ─── Career Paths Tab ───────────────────────────────────────────────────
function CareerPathsTab({ studentId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/student/${studentId}/career-paths`)
      .then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return <div className="card" style={{ color: 'var(--text-secondary)', padding: '2rem' }}><Activity size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />Loading career paths...</div>;
  if (!data) return null;

  const effortColor = { LOW: 'var(--risk-low)', MEDIUM: 'var(--risk-medium)', HIGH: 'var(--risk-high)' };

  return (
    <div className="card">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Map size={14} /> Alternate Career Path Engine</div>
        <span className="agentic-badge">Agentic AI</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Primary field: <strong>{data.primary_field}</strong></span>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Field demand: <strong style={{ color: data.primary_field_demand_score < 40 ? 'var(--risk-high)' : 'var(--risk-medium)' }}>{data.primary_field_demand_score}/100</strong></span>
        <span className={`badge ${data.trigger === 'low_field_demand' ? 'badge-high' : 'badge-info'}`}>
          {data.trigger === 'low_field_demand' ? '⚠ Low Demand — Alt paths recommended' : '🔍 Exploration Mode'}
        </span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>📍 {data.geography}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
        {data.recommended_paths?.map((path, i) => (
          <div key={i} style={{ padding: '0.9rem', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>#{path.rank} {path.role}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: effortColor[path.transition_effort], padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.04)' }}>
                {path.transition_effort}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>National demand: <strong style={{ color: 'var(--text-primary)' }}>{path.demand}/100</strong></span>
              <span>Regional: <strong style={{ color: 'var(--text-primary)' }}>{path.demand_in_region}/100</strong></span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Salary match: </span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: path.salary_match_pct >= 100 ? 'var(--risk-low)' : 'var(--risk-medium)' }}>
                {path.salary_match_pct >= 100 ? `+${path.salary_match_pct - 100}% higher` : `${100 - path.salary_match_pct}% lower`}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {path.skills_needed?.map((s, j) => (
                <span key={j} style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: 'var(--accent-primary)' }}>{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{data.note}</div>
    </div>
  );
}

// ─── Offer Survival Tab ─────────────────────────────────────────────────
function OfferSurvivalTab({ studentId }) {
  const [company, setCompany] = useState('TCS');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const companies = ['TCS', 'Infosys', 'Wipro', 'TechCorp Solutions', 'StartupXYZ'];

  const fetch = async (c) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/student/${studentId}/offer-survival`, { params: { company: c } });
      setData(res.data);
    } catch { setData(null); }
    setLoading(false);
  };

  useEffect(() => { fetch(company); }, [studentId]);

  const scoreColor = data ? (data.offer_survival_score >= 65 ? 'var(--risk-low)' : data.offer_survival_score >= 40 ? 'var(--risk-medium)' : 'var(--risk-high)') : 'var(--text-muted)';

  return (
    <div className="card">
      <div className="card-title"><Shield size={14} /> Offer Survival Score ⭐</div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Probability that a job offer will not be revoked within 60 days. Based on employer health signals: LinkedIn headcount trends, funding status, Glassdoor rating.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Select company:</span>
        {companies.map(c => (
          <button key={c} onClick={() => { setCompany(c); fetch(c); }}
            className={`badge ${company === c ? 'badge-info' : ''}`}
            style={{ cursor: 'pointer', border: company === c ? '1px solid var(--accent-primary)' : '1px solid transparent', opacity: company === c ? 1 : 0.55 }}>
            {c}
          </button>
        ))}
      </div>
      {loading && <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}><Activity size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />Computing...</div>}
      {data && !loading && (
        <div>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{data.offer_survival_score}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>/ 100 Survival Score</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <span className={`badge badge-${data.revocation_risk === 'LOW' ? 'low' : data.revocation_risk === 'MEDIUM' ? 'medium' : 'high'}`}>
                  {data.revocation_risk} Revocation Risk
                </span>
                <span className="badge badge-info">P(revocation 60d): {(data.p_revocation_60d * 100).toFixed(0)}%</span>
                <span className={`badge badge-${data.layoff_risk_assessment === 'LOW' ? 'low' : data.layoff_risk_assessment === 'MEDIUM' ? 'medium' : 'high'}`}>
                  Layoff: {data.layoff_risk_assessment}
                </span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${data.offer_survival_score}%`, background: scoreColor }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {data.risk_signals?.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--risk-high)', marginBottom: '0.5rem' }}>⚠ Risk Signals</div>
                {data.risk_signals.map((s, i) => <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>• {s}</div>)}
              </div>
            )}
            {data.positive_signals?.length > 0 && (
              <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--risk-low)', marginBottom: '0.5rem' }}>✓ Positive Signals</div>
                {data.positive_signals.map((s, i) => <div key={i} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>• {s}</div>)}
              </div>
            )}
          </div>
          <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', fontSize: '0.82rem' }}>
            <strong>📋 Recommended Action:</strong> {data.recommended_action}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Sources: {data.data_sources?.join(', ')} | Quality: {data.data_quality}</div>
        </div>
      )}
    </div>
  );
}

export default StudentProfile;
