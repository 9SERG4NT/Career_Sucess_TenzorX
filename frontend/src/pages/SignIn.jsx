import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import axios from 'axios';
import { ArrowLeft, ArrowRight, GraduationCap, Banknote, Building2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../App';
import { BrandMark } from '../components/AppShell';

const ROLES = [
  {
    id: 'student',
    label: 'Borrower',
    sub: 'Apply for an education loan and see your placement risk score.',
    icon: GraduationCap,
  },
  {
    id: 'admin',
    label: 'Lender',
    sub: 'Portfolio risk, drift monitor, intervention ROI.',
    icon: Banknote,
  },
  {
    id: 'college',
    label: 'College / Placement Cell',
    sub: 'Upload placement data & recruiters; see institute analytics.',
    icon: Building2,
  },
];

const ROLE_LABEL = { admin: 'Lender', college: 'College', student: 'Borrower' };

// Demo credentials — these mirror the seeded backend accounts. Login goes through
// the real /api/v1/auth/login endpoint; this map is only the offline fallback (and
// the hint text) used when the backend is unreachable.
const CREDS = {
  admin:   { username: 'admin',   password: '123', displayName: 'Lender Admin',    email: 'admin@poonawalla.in' },
  student: { username: 'student', password: '123', displayName: 'Borrower',        email: 'student@poonawalla.in', studentId: 'STU-2026-00001', institute: 'PF Institute' },
  college: { username: 'college', password: '123', displayName: 'Placement Office', email: 'college@poonawalla.in', institute: 'PF Institute' },
};

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get('role');
  const initialRole = ['admin', 'college', 'student'].includes(roleParam) ? roleParam : 'student';

  const [role, setRole] = useState(initialRole);
  const [username, setUsername] = useState(CREDS[initialRole].username);
  const [password, setPassword] = useState(CREDS[initialRole].password);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { signin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fromParam = searchParams.get('role');
    if (['admin', 'college', 'student'].includes(fromParam)) setRole(fromParam);
  }, [searchParams]);

  // Reset error when user edits
  useEffect(() => { if (error) setError(null); }, [username, password, role]); // eslint-disable-line

  const redirect = (u) => {
    setTimeout(() => {
      if (u.role === 'admin') navigate('/dashboard', { replace: true });
      else if (u.role === 'college') navigate('/college/dashboard', { replace: true });
      // A bound borrower lands on their dashboard (their record exists); a brand-new
      // demo borrower with no application still starts at /me/apply.
      else navigate(u.studentId ? '/me/dashboard' : '/me/apply', { replace: true });
    }, 200);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Real authentication against the backend accounts store.
      const res = await axios.post(`${API_BASE}/api/v1/auth/login`, {
        username: username.trim(), password,
      });
      const acct = res.data?.user || {};
      if (acct.role && acct.role !== role) {
        setSubmitting(false);
        setError(`Those credentials are for the ${ROLE_LABEL[acct.role] || acct.role} portal — switch the role above to sign in.`);
        return;
      }
      const u = signin({
        name: acct.name, email: acct.email, role: acct.role || role,
        institute: acct.institute, studentId: acct.student_id,
      });
      redirect(u);
    } catch (err) {
      if (err?.response?.status === 401) {
        const expected = CREDS[role];
        setSubmitting(false);
        setError(`Incorrect credentials for ${ROLE_LABEL[role]} portal. Default access: ${expected.username} / ${expected.password}.`);
        return;
      }
      // Backend unreachable → fall back to the hardcoded demo logins so the
      // prototype still works offline.
      const expected = CREDS[role];
      if (username.trim().toLowerCase() === expected.username && password === expected.password) {
        const u = signin({
          name: expected.displayName, email: expected.email, role,
          institute: expected.institute, studentId: expected.studentId,
        });
        redirect(u);
      } else {
        setSubmitting(false);
        setError(`Server is unreachable. Default credentials are: ${expected.username} / ${expected.password}.`);
      }
    }
  };

  const cred = CREDS[role];

  return (
    <div className="signin-page">
      {/* Topbar */}
      <header className="landing-topbar signin-topbar">
        <Link to="/" className="signin-back">
          <ArrowLeft size={14} /> <span>Home</span>
        </Link>
        <BrandMark size={36} />
        <span style={{ width: '60px' }} />
      </header>

      <main className="signin-main">
        <motion.div
          className="signin-card"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div className="landing-eyebrow signin-eyebrow">
            <span style={{ color: 'var(--signal)' }}>SIGN IN</span>
            <span style={{ width: '24px', height: '1px', background: 'var(--rule-strong)', display: 'inline-block' }} />
            <span>Pick your side</span>
          </div>

          <h1 className="signin-title">
            Welcome back to{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--signal)' }}>PlacementIQ.</em>
          </h1>

          {/* Role picker */}
          <div className="signin-roles">
            {ROLES.map((r) => {
              const active = r.id === role;
              return (
                <button
                  type="button"
                  key={r.id}
                  className={`signin-role ${active ? 'active' : ''}`}
                  onClick={() => { setRole(r.id); setUsername(CREDS[r.id].username); setPassword(CREDS[r.id].password); }}
                >
                  <div className="signin-role-icon">
                    <r.icon size={18} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                    <div className="signin-role-label">{r.label}</div>
                    <div className="signin-role-sub">{r.sub}</div>
                  </div>
                  <div className="signin-role-radio" aria-hidden>
                    <span />
                  </div>
                </button>
              );
            })}
          </div>

          

          <form onSubmit={handleSubmit} className="signin-form">
            <label className="signin-field">
              <span className="signin-field-label">Username</span>
              <input
                className="select-input signin-input mono"
                type="text"
                placeholder={cred.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
            </label>
            <label className="signin-field">
              <span className="signin-field-label">Password</span>
              <div className="signin-pw-wrap">
                <input
                  className="select-input signin-input mono"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="signin-pw-toggle" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="signin-error">
                <AlertTriangle size={14} /> <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary signin-submit" disabled={submitting}>
              {submitting ? 'Signing in…' : (
                <>
                  Sign in as {ROLE_LABEL[role]}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="signin-footnote">
          Your session persists across browser refreshes. Contact your administrator if you need help accessing your account.
          </div>
        </motion.div>
      </main>
    </div>
  );
}
