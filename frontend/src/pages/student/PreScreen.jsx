import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  motion, useInView, animate, useReducedMotion,
} from 'motion/react';
import {
  ArrowRight, CheckCircle2, Shield, Briefcase, IndianRupee,
  Handshake, Sparkles, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Big animated number
function BigNumber({ to, prefix = '', suffix = '', duration = 1.8, decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const ctl = animate(0, to, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (val) => setV(val),
    });
    return () => ctl.stop();
  }, [inView, to, duration, reduce]);

  const out = decimals === 0
    ? Math.round(v).toLocaleString('en-IN')
    : v.toFixed(decimals);

  return <span ref={ref}>{prefix}{out}{suffix}</span>;
}

export default function PreScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const result = state?.result || user?.lastPrescreen;
  const application = state?.application || user?.lastApplication;

  useEffect(() => {
    if (!result) navigate('/me/apply', { replace: true });
  }, [result, navigate]);

  if (!result) return null;

  const pred = result.prediction || {};
  const insights = result.insights || {};
  const offer = result.indicative_offer || {};
  const probs = pred.placement_probability || {};
  const salary = pred.salary_estimate || {};
  const recruiters = result.recruiter_matches || [];
  const nba = insights.recommended_nba || [];

  const riskBand = pred.risk_band || 'MEDIUM';
  const riskColor = riskBand === 'LOW' ? 'var(--risk-low)' : riskBand === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';
  const offerOk = offer.status === 'PRE-APPROVED';

  const handleAccept = () => {
    updateUser({ acceptedOffer: true });
    navigate('/me/dashboard');
  };

  return (
    <div className="prescreen-page animate-fade-up">
      {/* Eyebrow + headline */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>02</span>
            Instant Pre-Screen
          </div>
          <h1>
            <em style={{ fontStyle: 'italic' }}>{application?.name || 'Your'}</em>{' '} placement-risk score.
          </h1>
          <p style={{ marginTop: '0.55rem' }}>
            Scored by the same XGBoost + LightGBM + SHAP pipeline the lender sees. This is your <em>indicative</em> pre-screen — not a final sanction.
          </p>
        </div>
      </div>

      {/* HERO RESULT — placement % + salary + EMI comfort */}
      <motion.div
        className="card prescreen-hero"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div className="prescreen-hero-grid">
          {/* Placement % */}
          <div className="prescreen-hero-cell">
            <div className="card-title">6-Month Placement Probability</div>
            <div className="prescreen-big-num" style={{ color: riskColor }}>
              <BigNumber to={Math.round((probs['6m'] || 0) * 100)} suffix="" />
              <span className="prescreen-big-num-suffix">%</span>
            </div>
            <div className="progress-bar-track" style={{ height: '6px', marginTop: '0.85rem' }}>
              <motion.div
                className="progress-bar-fill"
                style={{ background: riskColor }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.round((probs['6m'] || 0) * 100)}%` }}
                transition={{ duration: 1.8, delay: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
              />
            </div>
            <div style={{ marginTop: '0.55rem', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              3m: <span className="mono">{Math.round((probs['3m'] || 0) * 100)}%</span>
              <span style={{ margin: '0 0.5em', color: 'var(--ink-faint)' }}>·</span>
              12m: <span className="mono">{Math.round((probs['12m'] || 0) * 100)}%</span>
            </div>
          </div>

          {/* Salary */}
          <div className="prescreen-hero-cell">
            <div className="card-title">Predicted Salary Band</div>
            <div className="prescreen-big-num" style={{ color: 'var(--ink)' }}>
              ₹<BigNumber to={Math.round((salary.median || pred.expected_salary || 0) / 1000)} />
              <span className="prescreen-big-num-suffix">K/yr</span>
            </div>
            <div style={{ marginTop: '0.85rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              <span>Low<br /><span className="mono" style={{ color: 'var(--ink)' }}>₹{Math.round((salary.low || 0) / 1000).toLocaleString('en-IN')}K</span></span>
              <span>High<br /><span className="mono" style={{ color: 'var(--ink)' }}>₹{Math.round((salary.high || 0) / 1000).toLocaleString('en-IN')}K</span></span>
            </div>
          </div>

          {/* EMI Comfort */}
          <div className="prescreen-hero-cell">
            <div className="card-title">EMI Comfort Index</div>
            <div className="prescreen-big-num" style={{ color: insights.emi_comfort_index >= 2 ? 'var(--risk-low)' : insights.emi_comfort_index >= 1.2 ? 'var(--risk-medium)' : 'var(--risk-high)' }}>
              {insights.emi_comfort_index === 99 ? '∞' : <BigNumber to={insights.emi_comfort_index || 0} decimals={1} suffix="×" />}
            </div>
            <div style={{ marginTop: '0.55rem', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              Predicted salary ÷ EMI. Target ≥ 2.0×.
            </div>
          </div>
        </div>

        {/* Risk band pill row */}
        <div className="prescreen-band-row">
          <span className={`badge badge-${riskBand.toLowerCase()}`} style={{ fontSize: '0.78rem' }}>
            {riskBand} risk
          </span>
          <span style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>
            Risk band determined by 6-month placement probability against lender thresholds.
          </span>
        </div>
      </motion.div>

      {/* Indicative Offer */}
      <motion.div
        className="card prescreen-offer"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10%' }}
        transition={{ duration: 0.65, delay: 0.1, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div className="prescreen-offer-head">
          <div>
            <div className="eyebrow" style={{ color: 'var(--signal)' }}>Indicative offer</div>
            <h2 className="prescreen-offer-title">
              {offerOk ? 'Pre-approved' : 'Conditional approval'}
              <span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: '0.5em', marginLeft: '0.6em', verticalAlign: 'middle', letterSpacing: '0.04em' }}>
                — pending final review
              </span>
            </h2>
          </div>
          {offerOk
            ? <CheckCircle2 size={32} color="var(--risk-low)" />
            : <AlertTriangle size={32} color="var(--risk-medium)" />}
        </div>
        <div className="prescreen-offer-grid">
          {[
            ['Sanctioned amount', `₹${(offer.sanctioned_amount || 0).toLocaleString('en-IN')}`],
            ['Requested', `₹${(offer.requested_amount || 0).toLocaleString('en-IN')}`],
            ['Interest rate', `${offer.interest_rate_band_pct?.min}–${offer.interest_rate_band_pct?.max}% p.a.`],
            ['Tenure', `${offer.tenure_years} years`],
          ].map(([k, v]) => (
            <div key={k} className="prescreen-offer-cell">
              <span className="prescreen-offer-cell-key">{k}</span>
              <span className="prescreen-offer-cell-val mono">{v}</span>
            </div>
          ))}
        </div>
        {offer.conditions?.length > 0 && (
          <ul className="prescreen-offer-conditions">
            {offer.conditions.map((c, i) => (
              <li key={i}><CheckCircle2 size={12} color="var(--risk-low)" /> {c}</li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* NBA + Recruiters side-by-side */}
      <div className="grid-2" style={{ marginTop: '1.5rem' }}>
        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="card-title"><Sparkles size={13} /> Next-Best Actions for you</div>
          {nba.slice(0, 4).map((item, i) => (
            <div key={i} className="nba-item">
              <span className={`nba-priority nba-${(item.priority || 'P2').toLowerCase()}`}>{item.priority}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)' }}>{item.action}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.2rem' }}>{item.description}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--signal)', marginTop: '0.3rem' }}>↑ {item.estimated_impact}</div>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          className="card"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <div className="card-title"><Handshake size={13} /> Recruiter matches for your profile</div>
          {recruiters.slice(0, 3).map((m, i) => (
            <div key={i} className="nba-item" style={{ borderLeftColor: 'var(--navy)' }}>
              <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--navy)', fontWeight: 600, marginTop: '2px', minWidth: '34px' }}>
                {Math.round(m.match_pct)}%
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)' }}>{m.name}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>
                  {m.sector} · {m.tier}
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                  <Briefcase size={10} style={{ verticalAlign: '-1px', marginRight: '4px' }} />
                  <span className="mono">{m.open_roles_30d}</span> open · 30d
                  <span style={{ margin: '0 0.5em', color: 'var(--ink-faint)' }}>·</span>
                  <IndianRupee size={10} style={{ verticalAlign: '-1px' }} />
                  <span className="mono">{(m.avg_offer_inr / 100000).toFixed(1)}L</span>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* CTA */}
      <div className="prescreen-cta-row">
        <Link to="/me/apply" className="btn btn-ghost">
          ← Edit application
        </Link>
        <button className="btn btn-primary" onClick={handleAccept}>
          Accept indicative offer · go to dashboard <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
