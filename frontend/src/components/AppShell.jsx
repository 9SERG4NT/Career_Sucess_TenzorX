import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate, useLocation, Outlet, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, BookOpen, LogOut,
  Building2, Settings, Brain, Sun, Moon, Zap,
  FileText, User as UserIcon, ShieldCheck, Sparkles, Archive, Plug, CheckCheck,
  Bell, Menu, X, PanelLeftClose, PanelLeftOpen, AlertTriangle, TrendingDown,
  GraduationCap, UserPlus,
} from 'lucide-react';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../App';
import Background3D from './Background3D';
import ChatWidget from './ChatWidget';

// ─── Brand mark — Poonawalla "P" lettermark ─────────────────────────
export function BrandMark({ size = 42, withWordmark = true, compact = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '2px',
        background: 'var(--navy)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.20), 0 1px 0 rgba(255,255,255,0.4)',
      }}>
        <svg width={size * 0.55} height={size * 0.6} viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="4.5" height="22" rx="1.5" fill="white"/>
          <path d="M6.5 2.5 H15.5 Q22 2.5 22 9.5 Q22 16.5 15.5 16.5 H6.5 Z" fill="white"/>
          <path d="M6.5 6 H14 Q18 6 18 9.5 Q18 13 14 13 H6.5 Z" fill="#1B2C5E"/>
        </svg>
      </div>
      {withWordmark && (
        <div className="brand-wordmark" style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: compact ? '1.05rem' : '1.18rem',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            fontVariationSettings: '"opsz" 36, "SOFT" 50',
            color: 'var(--ink)',
            lineHeight: 1.1,
          }}>
            PlacementIQ
          </div>
          <div style={{
            fontSize: '0.6rem',
            color: 'var(--ink-faint)',
            fontWeight: 700,
            letterSpacing: '0.18em',
            display: 'block',
            marginTop: '3px',
            textTransform: 'uppercase',
          }}>
            by Poonawalla Fincorp
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Admin (lender) sidebar nav items ───────────────────────────────
const ADMIN_NAV = [
  { path: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',         iconColor: '#1B2C5E' },
  { path: '/alerts',      icon: Bell,             label: 'Alerts & Signals',  iconColor: '#A82828' },
  { path: '/students',    icon: Users,            label: 'Portfolio',         iconColor: '#1E56C7' },
  { path: '/admin/onboard', icon: UserPlus,       label: 'Onboard Borrower',  iconColor: '#2F6E45' },
  { path: '/heatmap',     icon: BarChart3,        label: 'Heatmap',           iconColor: '#2F6E45' },
  { path: '/reports',     icon: BookOpen,         label: 'Reports & Drift',   iconColor: '#A5751F' },
  { path: '/institutes',  icon: Building2,        label: 'Institutes',        iconColor: '#1B2C5E' },
  { path: '/agentic',     icon: Brain,            label: 'AI Agents',         iconColor: '#C2410C' },
  { path: '/admin/audit', icon: Archive,          label: 'Audit Log',         iconColor: '#5E564B' },
  { path: '/admin',       icon: Settings,         label: 'Admin Panel',       iconColor: '#5E564B' },
];

const STUDENT_NAV = [
  { path: '/me/dashboard', icon: LayoutDashboard, label: 'My Dashboard',     iconColor: '#1B2C5E' },
  { path: '/me/academics', icon: GraduationCap,    label: 'My Profile',      iconColor: '#2F6E45' },
  { path: '/me/apply',     icon: FileText,         label: 'My Application',  iconColor: '#C2410C' },
  { path: '/me/profile',   icon: Plug,             label: 'Linked Profiles', iconColor: '#1E56C7' },
  { path: '/me/decision',  icon: CheckCheck,       label: 'Loan Decision',   iconColor: '#2F6E45' },
];

const COLLEGE_NAV = [
  { path: '/college/dashboard', icon: BarChart3, label: 'Placement Analytics', iconColor: '#2F6E45' },
  { path: '/college/data',      icon: Building2, label: 'Manage Data',         iconColor: '#1E56C7' },
];

function Sidebar({ navItems, variant, collapsed, onNavigate }) {
  const { theme, toggleTheme } = useTheme();
  const { user, signout } = useAuth();
  const navigate = useNavigate();

  const handleSignout = () => {
    signout();
    navigate('/');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <BrandMark size={40} />
      </div>

      <button onClick={toggleTheme} className="theme-toggle" title="Toggle theme">
        {theme === 'dark'
          ? <Sun size={15} color="#C2410C" />
          : <Moon size={15} color="#1B2C5E" />}
        <span className="nav-label">{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
      </button>

      <span className="sidebar-section-label">
        {variant === 'student' ? 'Borrower' : variant === 'college' ? 'Placement Cell' : 'Navigation'}
      </span>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map(({ path, icon: Icon, label, iconColor }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/dashboard' || path === '/me/dashboard' || path === '/admin'}
            onClick={onNavigate}
            title={label}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <div className="nav-icon-wrap" style={isActive ? { background: iconColor, borderColor: iconColor, color: 'var(--card-raised)' } : {}}>
                  <Icon size={16} />
                </div>
                <span className="nav-label" style={{ fontSize: '0.875rem' }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {variant === 'student' && (
        <div className="borrower-mini-quote hide-when-collapsed">
          Every loan is a bet on a career.
          <div style={{
            marginTop: '0.4rem',
            fontFamily: 'var(--font-sans)',
            fontStyle: 'normal',
            fontSize: '0.62rem',
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--ink-faint)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}>
            <Sparkles size={10} color="var(--signal)" /> PlacementIQ
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user-card" style={{
            padding: '0.6rem 0.75rem',
            border: '1px solid var(--card-edge)',
            borderLeft: '3px solid var(--signal)',
            marginBottom: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'var(--paper-deep)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <UserIcon size={14} color="var(--ink-muted)" />
            </div>
            <div className="nav-label" style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: '0.78rem', fontWeight: 700,
                color: 'var(--ink)', lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{user.name}</div>
              <div style={{
                fontSize: '0.62rem', letterSpacing: '0.14em',
                color: 'var(--ink-faint)', textTransform: 'uppercase',
                marginTop: '1px', fontWeight: 700,
              }}>
                {user.role === 'student' ? 'Borrower' : user.role === 'college' ? 'College' : 'Lender'}
              </div>
            </div>
          </div>
        )}

        {variant === 'admin' && (
          <div className="api-status-pill hide-when-collapsed">
            <span className="pulse-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--risk-low)', display: 'inline-block', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>API Live</div>
              <div style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', marginTop: '1px', fontFamily: 'var(--font-mono)' }}>v2.0 · 8001 · 10K records</div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'var(--risk-low-bg)',
              padding: '2px 8px',
              border: '1px solid var(--risk-low-edge)',
              borderRadius: '2px',
            }}>
              <Zap size={10} color="var(--risk-low)" />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--risk-low)', letterSpacing: '0.08em' }}>5 agents</span>
            </div>
          </div>
        )}

        {variant === 'student' && user && (
          <div className="hide-when-collapsed"><BorrowerStatusPill user={user} /></div>
        )}

        <button className="nav-item" onClick={handleSignout} title="Sign out" style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>
          <div className="nav-icon-wrap">
            <LogOut size={15} />
          </div>
          <span className="nav-label">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

// ─── Borrower-side status pill (fills the empty space the admin side has) ──
function BorrowerStatusPill({ user }) {
  const hasApp = Boolean(user?.lastPrescreen);
  const pred = user?.lastPrescreen?.prediction || {};
  const prob6m = Math.round(((pred.placement_probability || {})['6m'] || 0) * 100);
  const riskBand = pred.risk_band || (hasApp ? 'MEDIUM' : '—');
  const offerStatus = user?.lastPrescreen?.indicative_offer?.status || (hasApp ? 'PROCESSING' : 'NO APPLICATION');

  const bandColor = riskBand === 'LOW' ? 'var(--risk-low)'
                  : riskBand === 'HIGH' ? 'var(--risk-high)'
                  : 'var(--risk-medium)';

  return (
    <div className="borrower-status-pill" style={{ borderLeftColor: hasApp ? bandColor : 'var(--ink-faint)' }}>
      <ShieldCheck size={14} color={hasApp ? bandColor : 'var(--ink-faint)'} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label">
          {hasApp ? `${prob6m}% · ${riskBand}` : 'No application yet'}
        </div>
        <div className="sub">{offerStatus}</div>
      </div>
    </div>
  );
}

// ─── Notification bell — live alerts + shock feed (lender scope) ────────────
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState(null);
  const [shocks, setShocks] = useState(null);
  const [seen, setSeen] = useState(() => Number(localStorage.getItem('piq_alerts_seen') || 0));
  const ref = useRef(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      axios.get(`${API_BASE}/api/v1/alerts/active`).then(r => active && setAlerts(r.data)).catch(() => {});
      axios.get(`${API_BASE}/api/v1/shocks/active`).then(r => active && setShocks(r.data)).catch(() => {});
    };
    load();
    const id = setInterval(load, 60_000); // refresh every minute
    return () => { active = false; clearInterval(id); };
  }, []);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const shockList = shocks?.shocks || [];
  const critical = alerts?.critical_count || 0;
  const liveCount = shockList.length + critical;
  const unread = Math.max(0, liveCount - seen);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) { setSeen(liveCount); localStorage.setItem('piq_alerts_seen', String(liveCount)); }
  };

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="topbar-icon-btn notif-btn" onClick={handleToggle} aria-label="Notifications" title="Alerts & signals">
        <Bell size={18} />
        {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <span>Alerts &amp; Signals</span>
            <Link to="/alerts" onClick={() => setOpen(false)} className="notif-viewall">View all →</Link>
          </div>

          <div className="notif-list">
            {shockList.length === 0 && critical === 0 && (
              <div className="notif-empty">No active alerts. Portfolio is stable.</div>
            )}

            {shockList.slice(0, 3).map((s) => (
              <Link to="/alerts" key={s.shock_id} onClick={() => setOpen(false)} className="notif-item notif-item-high">
                <TrendingDown size={15} color="var(--risk-high)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ minWidth: 0 }}>
                  <div className="notif-item-title">Placement Shock — {s.sector}</div>
                  <div className="notif-item-sub">
                    {(s.geography || []).join(', ')} · {s.affected_students?.toLocaleString()} affected
                  </div>
                </div>
                <span className="badge badge-high" style={{ fontSize: '0.6rem', marginLeft: 'auto', flexShrink: 0 }}>{s.severity}</span>
              </Link>
            ))}

            {alerts?.total > 0 && (
              <Link to="/alerts" onClick={() => setOpen(false)} className="notif-item">
                <AlertTriangle size={15} color="var(--risk-medium)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ minWidth: 0 }}>
                  <div className="notif-item-title">Early Alert Engine — {alerts.total} active</div>
                  <div className="notif-item-sub">
                    {alerts.critical_count} critical · {alerts.high_count} high · {alerts.medium_count} medium
                  </div>
                </div>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Top bar — hamburger (mobile) + collapse toggle (desktop) + bell ────────
function AppTopbar({ variant, collapsed, onToggleCollapse, onOpenMobile }) {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="topbar-icon-btn mobile-only" onClick={onOpenMobile} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <button className="topbar-icon-btn desktop-only" onClick={onToggleCollapse} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <div className="topbar-brand mobile-only">
          <BrandMark size={30} withWordmark={false} />
          <span className="topbar-brand-name">PlacementIQ</span>
        </div>
      </div>

      <div className="topbar-right">
        {variant === 'admin' && <NotificationBell />}
      </div>
    </header>
  );
}

export default function AppShell({ variant = 'admin' }) {
  const navItems = variant === 'student' ? STUDENT_NAV
    : variant === 'college' ? COLLEGE_NAV : ADMIN_NAV;
  const { user } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('piq_sidebar_collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem('piq_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <div className={`app-container ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <Background3D />

      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}

      <Sidebar
        navItems={navItems}
        variant={variant}
        collapsed={collapsed}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="main-area">
        <AppTopbar
          variant={variant}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {/* Chat is scoped to student/admin only — college has no portfolio access. */}
      {(variant === 'student' || variant === 'admin') && (
        <ChatWidget
          scope={variant}
          studentId={variant === 'student' ? user?.studentId : null}
        />
      )}
    </div>
  );
}
