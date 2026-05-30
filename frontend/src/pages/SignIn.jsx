import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, GraduationCap, Banknote, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
];

// Hardcoded demo credentials (prototype only — no real auth)
const CREDS = {
  admin:   { username: 'admin',   password: '123', displayName: 'Lender Admin',   email: 'admin@poonawalla.demo' },
  student: { username: 'student', password: '123', displayName: 'Demo Borrower', email: 'student@poonawalla.demo' },
};

export default function SignIn() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'admin' ? 'admin' : 'student';

  const [role, setRole] = useState(initialRole);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const { signin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fromParam = searchParams.get('role');
    if (fromParam === 'admin' || fromParam === 'student') setRole(fromParam);
  }, [searchParams]);

  // Reset error when user edits
  useEffect(() => { if (error) setError(null); }, [username, password, role]); // eslint-disable-line

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const expected = CREDS[role];
    if (username.trim().toLowerCase() !== expected.username || password !== expected.password) {
      setSubmitting(false);
      setError(`Wrong credentials for ${role === 'admin' ? 'Lender' : 'Borrower'}. Try ${expected.username} / ${expected.password}.`);
      return;
    }

    const u = signin({ name: expected.displayName, email: expected.email, role });
    setTimeout(() => {
      if (u.role === 'admin') navigate('/dashboard', { replace: true });
      else navigate(u.hasApplication ? '/me/dashboard' : '/me/apply', { replace: true });
    }, 280);
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
                  onClick={() => { setRole(r.id); setUsername(''); setPassword(''); }}
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
                  placeholder="123"
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
                  Sign in as {role === 'admin' ? 'Lender' : 'Borrower'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="signin-footnote">
            Mock authentication — credentials hardcoded for the prototype. Sign-in state persists in localStorage so refresh keeps you where you were.
          </div>
        </motion.div>
      </main>
    </div>
  );
}
