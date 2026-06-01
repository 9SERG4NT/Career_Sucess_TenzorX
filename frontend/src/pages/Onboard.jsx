import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  UserPlus, RefreshCw, KeyRound, Copy, Check, CheckCircle2, AlertTriangle,
  ChevronRight, Users, RotateCcw,
} from 'lucide-react';
import { API_BASE } from '../App';

const COURSES = ['Engineering', 'MBA', 'Nursing'];
const REGIONS = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai'];
const TIERS = ['A', 'B', 'C', 'D'];
const EMPLOYER_TIERS = ['MNC', 'Unicorn', 'MidSize', 'Startup', 'Local'];

const bandColor = (b) => b === 'LOW' ? 'var(--risk-low)' : b === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';

const DEFAULT_FORM = {
  name: '', course_type: 'Engineering', institute_tier: 'B', institute_name: 'PF Demo Institute',
  region: 'Bengaluru', cgpa: 7.0, internship_months: 2, employer_tier: 'MNC',
  monthly_emi: 12000, active_backlogs: 0,
};

function Field({ label, children }) {
  return (
    <label className="apply-field" style={{ display: 'block' }}>
      <span className="apply-field-label">{label}</span>
      {children}
    </label>
  );
}

export default function Onboard() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [resetResult, setResetResult] = useState(null);   // {username, new_password}
  const [resetting, setResetting] = useState(null);       // username currently being reset

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const loadAccounts = useCallback(async () => {
    try {
      const r = await axios.get(`${API_BASE}/api/v1/admin/accounts`, { params: { role: 'student' } });
      setAccounts(r.data.accounts || []);
    } catch { /* backend offline — leave list empty */ }
  }, []);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Borrower name is required.'); return; }
    setSubmitting(true);
    setError(null);
    setIssued(null);
    try {
      const r = await axios.post(`${API_BASE}/api/v1/admin/accounts`, form);
      setIssued(r.data);
      setForm(DEFAULT_FORM);
      loadAccounts();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not onboard borrower. Is the backend running on port 8001?');
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (username) => {
    setResetting(username);
    setResetResult(null);
    try {
      const r = await axios.post(`${API_BASE}/api/v1/admin/accounts/${username}/reset-password`);
      setResetResult(r.data);
    } catch (e) {
      alert(`Reset failed: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setResetting(null);
    }
  };

  const copyCreds = () => {
    if (!issued) return;
    const text = `PlacementIQ login\nUsername: ${issued.credentials.username}\nPassword: ${issued.credentials.password}\nStudent ID: ${issued.student_id}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>Borrower Onboarding</div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <UserPlus size={26} color="var(--signal)" /> Create a borrower login.
        </h1>
        <p style={{ marginTop: '0.55rem', maxWidth: '64ch' }}>
          Creates a real portfolio record and issues credentials bound to it. Hand them to the borrower —
          they then keep their own academics current, and every edit re-scores live on your dashboard.
        </p>
      </div>

      {/* ─── Issued credentials — full-width prominent card ─── */}
      {issued && (
        <div className="card" style={{
          marginBottom: '1.75rem',
          border: '2px solid var(--risk-low)',
          background: 'var(--risk-low-bg)',
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <CheckCircle2 size={20} color="var(--risk-low)" />
              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--risk-low)' }}>
                Borrower created — copy these credentials before leaving this page
              </span>
            </div>
            <button className="btn btn-primary" onClick={copyCreds}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy all'}
            </button>
          </div>

          {/* Large credential boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginBottom: '1.1rem' }}>
            {[
              { label: 'Username', value: issued.credentials?.username, mono: true },
              { label: 'Temporary password', value: issued.credentials?.password, mono: true, highlight: true },
              { label: 'Student ID (bound)', value: issued.student_id, mono: true },
              { label: 'Initial risk band', value: `${issued.risk_band || '—'} · ${Math.round((issued.placement_6m || 0) * 100)}% (6m)`, mono: false },
            ].map(({ label, value, mono, highlight }) => (
              <div key={label} style={{
                background: 'var(--card-raised)',
                border: highlight ? '2px solid var(--signal)' : '1px solid var(--card-edge-strong)',
                borderRadius: '4px',
                padding: '0.85rem 1rem',
              }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '0.45rem' }}>
                  {label}
                </div>
                <div className={mono ? 'mono' : ''} style={{ fontSize: '1.15rem', fontWeight: 700, color: highlight ? 'var(--signal)' : 'var(--ink)', letterSpacing: mono ? '0.06em' : 0, wordBreak: 'break-all' }}>
                  {value || '—'}
                </div>
              </div>
            ))}
          </div>

          {/* Sign-in instructions */}
          <div style={{ background: 'var(--card-raised)', border: '1px solid var(--card-edge)', borderRadius: '4px', padding: '0.85rem 1rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: '0.6rem' }}>
              How the borrower signs in
            </div>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.84rem', color: 'var(--ink-soft)' }}>
              <li>Go to the PlacementIQ sign-in page.</li>
              <li>Select <strong>Borrower</strong> (first option).</li>
              <li>Enter username <strong className="mono">{issued.credentials?.username}</strong> and the temporary password above.</li>
              <li>They land on <em>My Dashboard</em> → can go to <em>My Academics</em> to update CGPA, backlogs, internships each semester.</li>
              <li>Every save re-scores instantly — your dashboard reflects it in real time.</li>
            </ol>
          </div>
        </div>
      )}

      {error && (
        <div className="alert-banner alert-high" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} color="var(--risk-high)" />
          <div style={{ fontSize: '0.85rem' }}>{error}</div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={submit} className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title"><KeyRound size={13} /> New borrower</div>
        <div className="apply-grid" style={{ marginTop: '0.85rem' }}>
          <Field label="Full name">
            <input className="select-input" type="text" value={form.name} placeholder="e.g. Aarav Sharma"
              onChange={(e) => set({ name: e.target.value })} autoFocus />
          </Field>
          <Field label="Course">
            <select className="select-input" value={form.course_type} onChange={(e) => set({ course_type: e.target.value })}>
              {COURSES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Institute name">
            <input className="select-input" type="text" value={form.institute_name}
              onChange={(e) => set({ institute_name: e.target.value })} />
          </Field>
          <Field label="Institute tier">
            <select className="select-input" value={form.institute_tier} onChange={(e) => set({ institute_tier: e.target.value })}>
              {TIERS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Region">
            <select className="select-input" value={form.region} onChange={(e) => set({ region: e.target.value })}>
              {REGIONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label={`CGPA · ${Number(form.cgpa).toFixed(1)}`}>
            <input type="range" min="4" max="10" step="0.1" value={form.cgpa}
              onChange={(e) => set({ cgpa: parseFloat(e.target.value) })} className="apply-slider" style={{ width: '100%' }} />
          </Field>
          <Field label={`Internship months · ${form.internship_months}`}>
            <input type="range" min="0" max="24" step="1" value={form.internship_months}
              onChange={(e) => set({ internship_months: parseInt(e.target.value, 10) })} className="apply-slider" style={{ width: '100%' }} />
          </Field>
          <Field label="Target employer tier">
            <select className="select-input" value={form.employer_tier} onChange={(e) => set({ employer_tier: e.target.value })}>
              {EMPLOYER_TIERS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Monthly EMI (₹)">
            <input className="select-input" type="number" min="0" step="500" value={form.monthly_emi}
              onChange={(e) => set({ monthly_emi: parseInt(e.target.value || 0, 10) })} />
          </Field>
          <Field label="Active backlogs">
            <input className="select-input" type="number" min="0" max="20" value={form.active_backlogs}
              onChange={(e) => set({ active_backlogs: parseInt(e.target.value || 0, 10) })} />
          </Field>
        </div>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '1rem' }}>
          {submitting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={14} />}
          {submitting ? 'Creating…' : 'Create borrower login'}
        </button>
      </form>

      {/* Password-reset result banner */}
      {resetResult && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--signal)', background: 'var(--paper-deep)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--signal)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={15} /> New password for <span className="mono">{resetResult.username}</span>
              </div>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <Cred label="Username" value={resetResult.username} mono />
                <Cred label="New temporary password" value={resetResult.new_password} mono />
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginTop: '0.6rem' }}>
                This is shown once — copy it now. Borrower logs in with <strong>Borrower</strong> role at the sign-in page.
              </p>
            </div>
            <button className="btn btn-ghost" onClick={() => {
              navigator.clipboard?.writeText(`Username: ${resetResult.username}\nNew password: ${resetResult.new_password}`);
            }}>
              <Copy size={13} /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Issued accounts */}
      <div className="card">
        <div className="card-title"><Users size={13} /> Issued borrower logins ({accounts.length})</div>
        {accounts.length === 0 ? (
          <div style={{ padding: '1.25rem 0', color: 'var(--ink-faint)', fontSize: '0.85rem' }}>
            No borrower logins issued yet (the seeded demo borrower aside). Create one above.
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: '0.75rem' }}>
              If a borrower has lost their password, click <strong>Reset</strong> to generate a new one — shown once, then gone.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Username</th><th>Name</th><th>Student ID</th><th>Institute</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.username}>
                      <td className="mono" style={{ fontWeight: 600, fontSize: '0.8rem' }}>{a.username}</td>
                      <td>{a.name}</td>
                      <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--navy)' }}>{a.student_id || '—'}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{a.institute || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {a.student_id && (
                            <Link to={`/student/${a.student_id}`} className="btn btn-ghost" style={{ padding: '0.3rem 0.7rem', fontSize: '0.76rem' }}>
                              View <ChevronRight size={12} />
                            </Link>
                          )}
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '0.3rem 0.7rem', fontSize: '0.76rem', color: 'var(--signal)' }}
                            onClick={() => resetPassword(a.username)}
                            disabled={resetting === a.username}
                            title="Generate a new temporary password"
                          >
                            {resetting === a.username
                              ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                              : <RotateCcw size={12} />}
                            Reset pwd
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Cred({ label, value, mono }) {
  return (
    <div>
      <div className="card-title" style={{ marginBottom: '0.3rem' }}>{label}</div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', letterSpacing: mono ? '0.04em' : 0 }}>
        {value}
      </div>
    </div>
  );
}
