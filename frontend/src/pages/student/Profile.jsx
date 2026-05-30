import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  Code2, ChartNetwork, Briefcase, Plug, CheckCircle2, X, ArrowRight,
  Sparkles, Info, RefreshCw, Unlink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../App';

const PROVIDERS = [
  {
    id: 'github',
    label: 'GitHub',
    icon: Code2,
    color: '#171B27',
    description: 'Live · public repos, followers, stars, languages from GitHub REST API. Weighs up to +8pp.',
    placeholder: 'e.g. torvalds',
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    icon: ChartNetwork,
    color: '#0A66C2',
    description: 'Best-effort: public-page Open Graph probe (name/headline/photo when available); deeper data requires enterprise partnership. Weighs up to +5pp.',
    placeholder: 'e.g. satyanadella',
  },
  {
    id: 'naukri',
    label: 'Naukri',
    icon: Briefcase,
    color: '#5C0AAE',
    description: 'Live cohort signal via Adzuna India (when configured) · per-borrower activity simulated (no public Naukri user API). Weighs up to +2pp.',
    placeholder: 'e.g. john_d',
  },
];

function ConnectModal({ provider, onClose, onConnect }) {
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const Icon = provider.icon;

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setSubmitting(true);
    await onConnect(provider.id, username.trim());
    setSubmitting(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <motion.div
        className="card modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '8px', background: provider.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>
              <Icon size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--ink)' }}>Connect {provider.label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>Simulated OAuth flow · no real credentials transmitted</div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={16} /></button>
        </div>

        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '0.45rem', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={provider.placeholder}
            autoFocus
            className="select-input"
            style={{ width: '100%', marginBottom: '1rem' }}
          />
          <div style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginBottom: '1.25rem', fontStyle: 'italic', lineHeight: 1.45 }}>
            <Info size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }} />
            Demo: profile data is synthesized deterministically from your username so the same name returns the same profile every time. Production would use real OAuth via the provider's API.
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!username.trim() || submitting}>
              {submitting ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plug size={13} />}
              {submitting ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ProfileCard({ provider, linked, onConnect, onDisconnect, index }) {
  const Icon = provider.icon;
  const data = linked?.profile_data;
  const score = linked?.profile_score;

  return (
    <motion.div
      className="card profile-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 * index }}
      style={{ borderTop: `3px solid ${provider.color}`, position: 'relative' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {linked?.profile_data?.avatar_url ? (
            <img
              src={linked.profile_data.avatar_url}
              alt=""
              style={{ width: '34px', height: '34px', borderRadius: '6px', objectFit: 'cover', border: `1px solid ${provider.color}` }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div style={{
              width: '34px', height: '34px', borderRadius: '6px', background: provider.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
            }}>
              <Icon size={16} />
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '1rem' }}>{provider.label}</div>
            {linked && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--ink-faint)' }}>
                <span>@{linked.username}</span>
                <span style={{
                  fontSize: '0.6rem', padding: '1px 6px', borderRadius: '2px', fontWeight: 700, letterSpacing: '0.10em',
                  background: linked.live_data ? 'rgba(47, 110, 69, 0.12)' : 'rgba(165, 117, 31, 0.12)',
                  color: linked.live_data ? 'var(--risk-low)' : 'var(--risk-medium)',
                  border: `1px solid ${linked.live_data ? 'var(--risk-low)' : 'var(--risk-medium)'}33`,
                }}>
                  {linked.live_data ? '● LIVE' : '◌ SIMULATED'}
                </span>
              </div>
            )}
          </div>
        </div>
        {linked && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>Score</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', lineHeight: 1, color: provider.color, fontWeight: 400, fontFeatureSettings: '"tnum"' }}>{score}</div>
          </div>
        )}
      </div>

      {!linked ? (
        <>
          <p style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.5, margin: '0 0 1.2rem' }}>{provider.description}</p>
          <button className="btn btn-primary" onClick={() => onConnect(provider)} style={{ width: '100%' }}>
            <Plug size={13} /> Connect {provider.label}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {provider.id === 'github' && (
              <>
                {data.name && <Row k="Name" v={data.name} />}
                <Row k="Public repos"   v={data.public_repos} />
                <Row k="Followers"      v={data.followers?.toLocaleString()} />
                <Row k="Stars earned"   v={data.stars_earned?.toLocaleString()} />
                {data.contributions_last_year != null && <Row k="Contributions" v={`${data.contributions_last_year}/yr`} />}
                <Row k="Top languages"  v={data.top_languages?.join(', ')} />
                {data.created_at && <Row k="Account age" v={`since ${data.created_at}`} />}
              </>
            )}
            {provider.id === 'linkedin' && (
              <>
                {data.name && <Row k="Name" v={data.name} />}
                <Row k="Headline"        v={data.headline} truncate />
                {data.current_company && (
                  <Row k="Current role" v={`${data.current_role || '—'} @ ${data.current_company}`} truncate />
                )}
                {data.location && <Row k="Location" v={data.location} />}
                <Row k="Connections"     v={data.connections?.toLocaleString?.() ?? data.connections} />
                {data.experience_count != null
                  ? <Row k="Experience" v={`${data.experience_count} roles`} />
                  : <Row k="Endorsements"  v={data.endorsements} />}
                {data.profile_completeness_pct != null && (
                  <Row k="Completeness"    v={`${data.profile_completeness_pct}%`} />
                )}
                <Row k="Top skills"      v={data.top_skills?.slice(0, 3).join(', ')} />
                {data.education?.length > 0 && (
                  <Row k="Education" v={data.education[0]?.school || '—'} truncate />
                )}
                {data.url_reachable && !data.experience_count && (
                  <Row k="URL verified" v="✓ Public profile reachable" />
                )}
              </>
            )}
            {provider.id === 'naukri' && (
              <>
                <Row k="Applications · 30d"   v={data.applications_30d} />
                <Row k="Recruiter views · 30d" v={data.recruiter_views_30d} />
                <Row k="Callbacks · 30d"       v={data.callbacks_30d} />
                <Row k="Profile views · 30d"   v={data.profile_views_30d} />
                {data.cohort_signal && (
                  <>
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--rule)', fontSize: '0.66rem', color: 'var(--risk-low)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}>
                      ● Live cohort signal · Adzuna India
                    </div>
                    <Row k="Open roles · cohort" v={data.cohort_signal.open_roles_30d_estimate?.toLocaleString()} />
                    {data.cohort_signal.avg_salary_inr > 0 && <Row k="Avg salary (mkt)" v={`₹${(data.cohort_signal.avg_salary_inr / 100000).toFixed(1)}L`} />}
                  </>
                )}
              </>
            )}
          </div>

          {/* Source label */}
          {linked.source_label && (
            <div style={{ marginTop: '0.4rem', marginBottom: '0.6rem', fontSize: '0.7rem', color: 'var(--ink-faint)', fontStyle: 'italic', lineHeight: 1.45 }}>
              {linked.source_label}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--risk-low)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={12} /> Connected
            </span>
            <button className="btn btn-ghost" onClick={() => onDisconnect(provider.id)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
              <Unlink size={11} /> Disconnect
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}

function Row({ k, v, truncate }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', fontSize: '0.82rem' }}>
      <span style={{ color: 'var(--ink-muted)', flexShrink: 0 }}>{k}</span>
      <span style={{
        color: 'var(--ink)', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: truncate ? 'nowrap' : 'normal',
      }}>
        {v ?? '—'}
      </span>
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [linkedProfiles, setLinkedProfiles] = useState({});
  const [aggregate, setAggregate] = useState(null);
  const [modalProvider, setModalProvider] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    if (!user?.studentId) return;
    try {
      const r = await axios.get(`${API_BASE}/api/v1/profile/${user.studentId}`);
      setLinkedProfiles(r.data.linked_profiles || {});
      setAggregate(r.data);
      updateUser({ linkedProfiles: r.data.linked_profiles || {} });
    } catch {
      setLinkedProfiles({});
    }
    setLoading(false);
  }, [user?.studentId, updateUser]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleConnect = async (providerId, username) => {
    try {
      await axios.post(`${API_BASE}/api/v1/profile/link`, {
        student_id: user.studentId, provider: providerId, username,
      });
      setModalProvider(null);
      await fetchProfiles();
    } catch (e) {
      alert(`Connection failed: ${e.message}`);
    }
  };

  const handleDisconnect = async (providerId) => {
    try {
      await axios.delete(`${API_BASE}/api/v1/profile/${user.studentId}/${providerId}`);
      await fetchProfiles();
    } catch (e) {
      alert(`Disconnect failed: ${e.message}`);
    }
  };

  const linkedCount = Object.keys(linkedProfiles).length;
  const boost = aggregate?.aggregate_boost_pp || 0;

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
          Profile Linking
        </div>
        <h1>Strengthen your application.</h1>
        <p style={{ marginTop: '0.55rem', maxWidth: '60ch' }}>
          Connect external profiles so our model can incorporate signals from GitHub, LinkedIn, and Naukri.
          Each verified profile adds a capped boost to your placement-probability score.
        </p>
      </div>

      {/* Aggregate boost hero */}
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--signal)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="card-title"><Sparkles size={13} /> Aggregate boost</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.4rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.6rem', lineHeight: 1, color: 'var(--signal)', fontWeight: 400, fontFeatureSettings: '"tnum"' }}>
                +{boost}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>pp added to placement probability</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginTop: '0.3rem' }}>
              {linkedCount} of 3 providers linked · max possible: +15 pp
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/me/decision')}
            disabled={linkedCount === 0 && !user?.lastApplication}
            style={{ alignSelf: 'flex-end' }}
          >
            Get Final Decision <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Provider cards */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ink-muted)' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading…
        </div>
      ) : (
        <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
          {PROVIDERS.map((p, i) => (
            <ProfileCard
              key={p.id}
              provider={p}
              linked={linkedProfiles[p.id]}
              onConnect={setModalProvider}
              onDisconnect={handleDisconnect}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Honest framing footer */}
      <div className="card" style={{ borderLeft: '3px solid var(--ink-faint)' }}>
        <div className="card-title" style={{ marginBottom: '0.6rem' }}><Info size={12} /> What's live vs simulated</div>
        <div style={{ display: 'grid', gap: '0.55rem', fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
          <div><strong style={{ color: 'var(--risk-low)' }}>● GitHub — LIVE.</strong> Fetched from the public REST API. Repos, followers, stars, languages, account age are real.</div>
          <div><strong style={{ color: 'var(--risk-medium)' }}>◐ LinkedIn — depends on config.</strong> Real data via People Data Labs (free 100 credits, set <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}>PDL_API_KEY</code>) or Proxycurl (free 10 credits, set <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}>PROXYCURL_API_KEY</code>) in <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}>backend/.env</code>. Without those, we fall back to a public-page probe — usually blocked by LinkedIn bot detection (HTTP 999) since 2018, then simulated.</div>
          <div><strong style={{ color: 'var(--risk-medium)' }}>◐ Naukri — hybrid.</strong> Cohort-level job-market signal is live via Adzuna India (set <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}>ADZUNA_APP_ID</code> + <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}>ADZUNA_APP_KEY</code> in <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78em' }}>backend/.env</code>). Per-borrower application activity is simulated because no public Naukri API exposes individual user data.</div>
        </div>
      </div>

      {modalProvider && (
        <ConnectModal
          provider={modalProvider}
          onClose={() => setModalProvider(null)}
          onConnect={handleConnect}
        />
      )}
    </div>
  );
}
