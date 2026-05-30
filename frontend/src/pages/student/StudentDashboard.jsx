import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import axios from 'axios';
import {
  Shield, Briefcase, Sparkles, Handshake, IndianRupee,
  Award, MessageSquare, FileText, CheckCircle2, ArrowRight, FilePen,
  Plug, CheckCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../App';

export default function StudentDashboard() {
  const { user } = useAuth();
  const result = user?.lastPrescreen;
  const application = user?.lastApplication;
  const [profileAgg, setProfileAgg] = useState(null);

  useEffect(() => {
    if (!user?.studentId) return;
    axios.get(`${API_BASE}/api/v1/profile/${user.studentId}`)
      .then(r => setProfileAgg(r.data))
      .catch(() => {});
  }, [user?.studentId]);

  // No application yet → route to apply
  if (!result) {
    return (
      <div className="animate-fade-up">
        <div className="page-header">
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            My Dashboard
          </div>
          <h1>Welcome to PlacementIQ.</h1>
          <p style={{ marginTop: '0.55rem' }}>You haven't submitted a loan application yet. Start one to see your placement-risk profile.</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <FilePen size={36} style={{ color: 'var(--ink-faint)', marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No application on file</h3>
          <p style={{ color: 'var(--ink-muted)', marginBottom: '1.5rem', maxWidth: '46ch', margin: '0 auto 1.5rem' }}>
            Submit a 3-step loan application and get your instant placement-risk pre-screen, NBA plan, and recruiter matches.
          </p>
          <Link to="/me/apply" className="btn btn-primary">
            Start application <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  const pred = result.prediction || {};
  const insights = result.insights || {};
  const offer = result.indicative_offer || {};
  const probs = pred.placement_probability || {};
  const salary = pred.salary_estimate || {};
  const recruiters = result.recruiter_matches || [];
  const nba = insights.recommended_nba || [];
  const applicant = result.applicant || {};

  const riskBand = pred.risk_band || 'MEDIUM';
  const riskColor = riskBand === 'LOW' ? 'var(--risk-low)' : riskBand === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>My Dashboard</span>
          </div>
          <h1>
            Hi <em style={{ fontStyle: 'italic' }}>{user?.name?.split(' ')[0] || 'there'}</em> — here's your trajectory.
          </h1>
          <p style={{ marginTop: '0.55rem' }}>
            Score updates live as you complete interventions. Your lender sees the same dashboard.{' '}
            <span className={`badge badge-${offer.status === 'PRE-APPROVED' ? 'low' : 'medium'}`} style={{ marginLeft: '0.4em', verticalAlign: '2px' }}>
              {offer.status || 'PROCESSING'}
            </span>
          </p>
        </div>
        <Link to="/me/apply" className="btn btn-ghost">
          <FilePen size={14} /> Edit application
        </Link>
      </div>

      {/* Application review progress (if submitted) */}
      {user?.lastApplication?.status === 'UNDER_REVIEW' && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--signal)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="card-title">Application status</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--ink)' }}>Under review by lender</div>
            </div>
            <div style={{ minWidth: '220px' }}>
              <div className="progress-bar-track" style={{ height: '10px', marginBottom: '0.45rem' }}>
                <div className="progress-bar-fill" style={{ width: `${user.lastApplication.progress || 10}%`, background: 'var(--signal)' }} />
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>{user.lastApplication.progress || 10}% complete</div>
            </div>
          </div>
        </div>
      )}

      {/* KPI row */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        {[
          {
            title: '6M Placement',
            value: `${Math.round((probs['6m'] || 0) * 100)}%`,
            sub: `3m: ${Math.round((probs['3m'] || 0) * 100)}% · 12m: ${Math.round((probs['12m'] || 0) * 100)}%`,
            color: riskColor,
          },
          {
            title: 'Salary band',
            value: `₹${Math.round((salary.median || 0) / 1000).toLocaleString('en-IN')}K`,
            sub: `Low ₹${Math.round((salary.low || 0) / 1000)}K · High ₹${Math.round((salary.high || 0) / 1000)}K`,
            color: 'var(--ink)',
          },
          {
            title: 'EMI comfort',
            value: insights.emi_comfort_index === 99 ? '∞' : `${(insights.emi_comfort_index || 0).toFixed(1)}×`,
            sub: 'Salary ÷ EMI · target ≥ 2.0×',
            color: insights.emi_comfort_index >= 2 ? 'var(--risk-low)' : insights.emi_comfort_index >= 1.2 ? 'var(--risk-medium)' : 'var(--risk-high)',
          },
          {
            title: 'Risk band',
            value: riskBand,
            sub: 'Determined by lender risk thresholds',
            color: riskColor,
          },
        ].map((k, i) => (
          <motion.div
            key={k.title}
            className="card card-sm"
            style={{ borderTop: `2px solid ${k.color}` }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.06 * i }}
          >
            <div className="card-title">{k.title}</div>
            <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
            <div className="stat-sub">{k.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Linked profiles + Final decision CTA */}
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--signal)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title" style={{ marginBottom: '0.3rem' }}><Plug size={13} /> Linked external profiles</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--signal)', lineHeight: 1, fontWeight: 400, fontFeatureSettings: '"tnum"' }}>
                {profileAgg?.providers_linked?.length || 0}<span style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginLeft: '4px' }}>/3</span>
              </span>
              {profileAgg?.aggregate_boost_pp > 0 && (
                <span style={{ fontSize: '0.82rem', color: 'var(--risk-low)' }}>
                  +{profileAgg.aggregate_boost_pp}pp boost
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginTop: '0.2rem' }}>
              {profileAgg?.providers_linked?.length > 0
                ? profileAgg.providers_linked.join(' · ')
                : 'Connect GitHub, LinkedIn, Naukri to strengthen your application'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <Link to="/me/profile" className="btn btn-ghost"><Plug size={13} /> Manage profiles</Link>
          <Link to="/me/decision" className="btn btn-primary"><CheckCheck size={13} /> Get Final Decision</Link>
        </div>
      </div>

      {/* Career readiness — reuses the same signals as the lender view */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderTop: '2px solid var(--navy)' }}>
          <div className="card-title"><Award size={13} /> Skill certifications</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', marginBottom: '0.85rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '2.4rem', lineHeight: 1, fontVariationSettings: '"opsz" 96', color: 'var(--ink)' }}>
              {applicant.skill_certs_count ?? 0}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>held</span>
          </div>
          {applicant.skill_certifications?.length > 0 ? (
            applicant.skill_certifications.map((c, i) => (
              <div key={i} style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.3rem 0', borderBottom: i < applicant.skill_certifications.length - 1 ? '1px solid var(--rule)' : 'none' }}>
                <CheckCircle2 size={12} color="var(--risk-low)" />
                <span>{c}</span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>No certifications on file. Add 2–3 field-relevant certs to lift your score.</div>
          )}
        </div>

        <div className="card" style={{ borderTop: '2px solid var(--signal)' }}>
          <div className="card-title"><MessageSquare size={13} /> Interview pipeline</div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '2.4rem', lineHeight: 1, color: 'var(--signal)' }}>
              {applicant.interview_progress_score ?? 0}
              <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-sans)', marginLeft: '3px' }}>/100</span>
            </span>
            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-muted)', textAlign: 'right', lineHeight: 1.3 }}>
              <div>{applicant.interviews_scheduled_30d ?? 0} sched / 30d</div>
              <div>{applicant.interviews_cleared_30d ?? 0} cleared</div>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.78rem' }}>
            {Object.entries(applicant.interview_stages_30d || {}).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-muted)', textTransform: 'capitalize' }}>{k}</span>
                <span className="mono">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ borderTop: '2px solid var(--ink)' }}>
          <div className="card-title"><FileText size={13} /> Resume freshness</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.55rem', marginBottom: '0.55rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: '2.4rem', lineHeight: 1 }}>
              {applicant.resume_freshness_days ?? '—'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>days</span>
          </div>
          <div style={{ fontSize: '0.86rem', color: 'var(--ink-soft)', marginBottom: '0.85rem' }}>
            Last updated <strong>{applicant.resume_last_updated_label || '—'}</strong>
          </div>
          {(applicant.resume_freshness_days ?? 0) > 30 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--signal)', fontStyle: 'italic' }}>
              Recommended — refresh in the next week.
            </div>
          )}
        </div>
      </div>

      {/* NBA + Recruiters */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-title"><Sparkles size={13} /> Your Next-Best Actions</div>
          {nba.length === 0 && <div style={{ fontSize: '0.82rem', color: 'var(--ink-faint)' }}>No actions queued.</div>}
          {nba.slice(0, 5).map((item, i) => (
            <div key={i} className="nba-item">
              <span className={`nba-priority nba-${(item.priority || 'P2').toLowerCase()}`}>{item.priority}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)' }}>{item.action}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.2rem' }}>{item.description}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--signal)', marginTop: '0.3rem' }}>↑ {item.estimated_impact}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-title"><Handshake size={13} /> Recruiters who match you</div>
          {recruiters.map((m, i) => (
            <div key={i} className="nba-item" style={{ borderLeftColor: 'var(--navy)' }}>
              <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--navy)', fontWeight: 600, marginTop: '2px', minWidth: '38px' }}>
                {Math.round(m.match_pct)}%
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{m.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '2px' }}>
                  {m.sector} · {m.tier}
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                  <Briefcase size={10} style={{ verticalAlign: '-1px', marginRight: '4px' }} />
                  <span className="mono">{m.open_roles_30d}</span> open · 30d
                  <span style={{ margin: '0 0.5em', color: 'var(--ink-faint)' }}>·</span>
                  <IndianRupee size={10} style={{ verticalAlign: '-1px' }} />
                  <span className="mono">{(m.avg_offer_inr / 100000).toFixed(1)}L</span>
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{m.rationale}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lender notes — closes the two-sided loop */}
      <div className="card" style={{ borderLeft: '3px solid var(--signal)' }}>
        <div className="card-title"><Shield size={13} /> Notes from your lender</div>
        <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: '1.05rem', lineHeight: 1.5, color: 'var(--ink)', marginBottom: '0.5rem' }}>
          We're routing a free mock-interview voucher to your registered email this week.
          Completing 3 mock interviews historically lifts placement probability by 8–11 pp for borrowers in your cohort.
        </p>
        <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
          — Demo Fincorp · Portfolio Operations
        </div>
      </div>
    </div>
  );
}
