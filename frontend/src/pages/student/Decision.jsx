import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  CheckCircle2, AlertTriangle, XCircle, ArrowRight, RefreshCw,
  ShieldCheck, IndianRupee, Percent, Calendar, Sparkles, Info, Plug,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../App';

const DECISION_META = {
  APPROVE:     { color: 'var(--risk-low)',    Icon: CheckCircle2,   title: 'Application Pre-Approved',     subtitle: 'You qualify for the requested loan terms.' },
  CONDITIONAL: { color: 'var(--risk-medium)', Icon: AlertTriangle,  title: 'Conditional Approval',         subtitle: 'Approved with conditions — see below.' },
  DENY:        { color: 'var(--risk-high)',   Icon: XCircle,         title: 'Manual Review Required',        subtitle: 'Automated decision is unfavorable — a human underwriter will review.' },
};

export default function Decision() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decision, setDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDecision = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await axios.post(`${API_BASE}/api/v1/loan/decide`, { student_id: user.studentId });
      setDecision(r.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.studentId) fetchDecision(); }, [user?.studentId]);

  if (loading) {
    return (
      <div className="animate-fade-up" style={{ padding: '3rem', textAlign: 'center' }}>
        <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--signal)' }} />
        <p style={{ marginTop: '0.75rem', color: 'var(--ink-muted)' }}>Running final decision pipeline…</p>
      </div>
    );
  }

  if (error || !decision) {
    return (
      <div className="animate-fade-up">
        <div className="alert-banner alert-high">
          <AlertTriangle size={18} color="var(--risk-high)" />
          <div>
            <strong>Decision Unavailable</strong>
            <p style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>{error || 'Backend returned no decision.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const meta = DECISION_META[decision.decision] || DECISION_META.CONDITIONAL;
  const Icon = meta.Icon;
  const offer = decision.final_offer;
  const isColdStart = decision.cold_start;
  const confidence = decision.confidence_band;

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
          Final Loan Decision
        </div>
        <h1>Your decision is ready.</h1>
      </div>

      {/* Cold-start banner (Architect Review demonstration) */}
      {isColdStart && (
        <motion.div
          className="alert-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(165, 117, 31, 0.06)',
            border: '1px solid rgba(165, 117, 31, 0.25)',
            borderLeftColor: 'var(--risk-medium)',
            marginBottom: '1.25rem',
          }}
        >
          <Info size={18} color="var(--risk-medium)" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--risk-medium)' }}>Cold-start borrower · LOW confidence</strong>
            <p style={{ fontSize: '0.82rem', marginTop: '0.25rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
              {decision.confidence_note} Per our fairness guardrails, risk band is capped at MEDIUM for borrowers
              with insufficient signals — we do not deny credit based on cohort priors alone.
            </p>
          </div>
        </motion.div>
      )}

      {/* Decision hero */}
      <motion.div
        className="card decision-hero"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `linear-gradient(135deg, ${meta.color}11, ${meta.color}04)`,
          border: `1px solid ${meta.color}33`,
          borderLeft: `4px solid ${meta.color}`,
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px', background: `${meta.color}1A`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: meta.color, flexShrink: 0,
          }}>
            <Icon size={28} />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.65rem', color: meta.color, lineHeight: 1.1, fontWeight: 400 }}>
              {meta.title}
            </div>
            <div style={{ fontSize: '0.92rem', color: 'var(--ink-soft)', marginTop: '0.2rem' }}>{meta.subtitle}</div>
          </div>
          <span className={`badge ${confidence === 'HIGH' ? 'badge-low' : confidence === 'LOW' ? 'badge-high' : 'badge-medium'}`} style={{ marginLeft: 'auto', flexShrink: 0 }}>
            {confidence} confidence
          </span>
        </div>

        {/* Score panel */}
        <div className="decision-score-grid">
          <div>
            <div className="card-title" style={{ marginBottom: '0.3rem' }}>6M placement probability</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: meta.color, fontFeatureSettings: '"tnum"', lineHeight: 1, fontWeight: 400 }}>
                {Math.round(decision.adjusted_placement_6m * 100)}%
              </span>
              {decision.profile_boost_applied_pp > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--signal)' }}>
                  ↑ {decision.profile_boost_applied_pp}pp from profiles
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '0.25rem' }}>
              base ML output: {Math.round(decision.base_placement_6m * 100)}%
            </div>
          </div>
          <div>
            <div className="card-title" style={{ marginBottom: '0.3rem' }}>Risk band</div>
            <span className={`badge badge-${(decision.adjusted_risk_band || 'medium').toLowerCase()}`} style={{ fontSize: '0.78rem' }}>
              {decision.adjusted_risk_band}
            </span>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '0.35rem' }}>
              EMI comfort: {decision.emi_comfort_index?.toFixed(1)}× · CGPA: {decision.cgpa?.toFixed(2)}
            </div>
          </div>
          <div>
            <div className="card-title" style={{ marginBottom: '0.3rem' }}>Profiles linked</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--signal)', lineHeight: 1, fontWeight: 400, fontFeatureSettings: '"tnum"' }}>
                {decision.providers_linked?.length || 0}<span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginLeft: '4px' }}>/3</span>
              </span>
            </div>
            <div className="progress-bar-track" style={{ marginTop: '0.25rem' }}>
              <div className="progress-bar-fill" style={{ width: `${((decision.providers_linked?.length || 0) / 3) * 100}%`, background: 'var(--signal)' }} />
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '0.35rem' }}>
              {decision.providers_linked?.join(', ') || 'none'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Reasons + Offer side by side */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Why this decision */}
        <div className="card">
          <div className="card-title"><Sparkles size={13} /> Why this decision</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {decision.decision_reasons?.map((r, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.55rem', fontSize: '0.86rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                <span style={{ color: meta.color, flexShrink: 0, fontWeight: 700 }}>·</span>
                {r}
              </li>
            ))}
          </ul>
          {decision.profile_boost_reasons?.length > 0 && (
            <>
              <hr className="divider" style={{ margin: '1rem 0 0.75rem' }} />
              <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Profile-derived boost breakdown
              </div>
              {decision.profile_boost_reasons.map((r, i) => (
                <div key={i} style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '0.25rem' }}>· {r}</div>
              ))}
            </>
          )}
        </div>

        {/* Offer panel */}
        {offer && (
          <div className="card" style={{ borderTop: `2px solid ${meta.color}` }}>
            <div className="card-title"><ShieldCheck size={13} /> {decision.decision === 'DENY' ? 'Next Steps' : 'Offer Terms'}</div>
            {offer.sanctioned_amount_inr > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.6rem', marginBottom: '0.4rem' }}>
                <IndianRupee size={20} color={meta.color} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: meta.color, lineHeight: 1, fontWeight: 400, fontFeatureSettings: '"tnum"' }}>
                  {(offer.sanctioned_amount_inr / 100000).toFixed(1)}<span style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', marginLeft: '4px' }}>Lakh</span>
                </span>
              </div>
            )}
            {offer.interest_rate_band_pct && (
              <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', marginBottom: '0.85rem' }}>
                <Percent size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }} />
                {offer.interest_rate_band_pct.min}–{offer.interest_rate_band_pct.max}% interest
                <span style={{ margin: '0 0.5em', color: 'var(--ink-faint)' }}>·</span>
                <Calendar size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }} />
                {offer.tenure_years}-year tenure
              </div>
            )}
            <div style={{ borderTop: '1px solid var(--rule)', paddingTop: '0.65rem', marginTop: '0.65rem' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.45rem' }}>
                Conditions
              </div>
              {offer.conditions?.map((c, i) => (
                <div key={i} style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginBottom: '0.3rem', display: 'flex', gap: '6px' }}>
                  <CheckCircle2 size={11} color="var(--ink-faint)" style={{ marginTop: '3px', flexShrink: 0 }} />
                  <span>{c}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {decision.decision === 'APPROVE' && (
          <button className="btn btn-primary" style={{ background: 'var(--risk-low)', borderColor: 'var(--risk-low)' }}>
            <CheckCircle2 size={13} /> Accept Offer
          </button>
        )}
        {decision.decision === 'CONDITIONAL' && (
          <>
            <Link to="/me/profile" className="btn btn-primary">
              <Plug size={13} /> Improve Score
            </Link>
            <button className="btn btn-ghost">Accept Conditional Offer</button>
          </>
        )}
        {decision.decision === 'DENY' && (
          <>
            <button className="btn btn-primary" style={{ background: 'var(--signal)', borderColor: 'var(--signal)' }}>
              <ArrowRight size={13} /> Request Manual Review
            </button>
            <Link to="/me/profile" className="btn btn-ghost">Strengthen Profile</Link>
          </>
        )}
        <button className="btn btn-ghost" onClick={fetchDecision}>
          <RefreshCw size={13} /> Re-run Decision
        </button>
      </div>

      {/* Mandatory fairness note */}
      <div className="card" style={{ borderLeft: '3px solid var(--signal)', background: 'var(--card-raised)' }}>
        <div className="card-title"><ShieldCheck size={13} /> Fairness & Governance</div>
        <p style={{ fontSize: '0.84rem', color: 'var(--ink-soft)', lineHeight: 1.55, margin: '0.4rem 0' }}>
          {decision.fairness_note}
        </p>
        {decision.audit?.decision_id && (
          <div style={{ marginTop: '0.65rem', fontSize: '0.7rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>
            Audit ID: <span style={{ color: 'var(--ink-muted)' }}>{decision.audit.decision_id}</span>
            <span style={{ margin: '0 0.7em' }}>·</span>
            Model: <span style={{ color: 'var(--ink-muted)' }}>{decision.audit.model_version}</span>
            <span style={{ margin: '0 0.7em' }}>·</span>
            Retained until: <span style={{ color: 'var(--ink-muted)' }}>{decision.audit.retained_until_utc?.slice(0, 10)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
