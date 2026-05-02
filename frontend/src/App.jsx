import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, BarChart3, BookOpen,
  LogOut, Building2, Settings, Brain, Sun, Moon, Zap
} from 'lucide-react';
import './App.css';
import Dashboard from './pages/Dashboard';
import StudentProfile from './pages/StudentProfile';
import Heatmap from './pages/Heatmap';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Institutes from './pages/Institutes';
import AgenticInsights from './pages/AgenticInsights';
import Background3D from './components/Background3D';
import { useTheme } from './context/ThemeContext';

const API_BASE = 'http://localhost:8001';
export { API_BASE };

const NAV_ITEMS = [
  { path: '/',          icon: LayoutDashboard, label: 'Dashboard',         iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,0.15)'  },
  { path: '/students',  icon: Users,            label: 'Portfolio',         iconColor: '#06B6D4', iconBg: 'rgba(6,182,212,0.12)'   },
  { path: '/heatmap',   icon: BarChart3,        label: 'Heatmap',           iconColor: '#10B981', iconBg: 'rgba(16,185,129,0.12)'  },
  { path: '/reports',   icon: BookOpen,         label: 'Reports & Drift',   iconColor: '#F59E0B', iconBg: 'rgba(245,158,11,0.12)'  },
  { path: '/institutes',icon: Building2,        label: 'Institutes',        iconColor: '#8B5CF6', iconBg: 'rgba(139,92,246,0.12)'  },
  { path: '/agentic',   icon: Brain,            label: 'AI Agents',         iconColor: '#F43F5E', iconBg: 'rgba(244,63,94,0.12)'   },
  { path: '/admin',     icon: Settings,         label: 'Admin Panel',       iconColor: '#94A3B8', iconBg: 'rgba(148,163,184,0.1)'  },
];

function Sidebar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="sidebar">
      {/* Logo — Poonawalla Fincorp Brand */}
      <div className="sidebar-logo" style={{ marginBottom: '1.25rem', alignItems: 'center', gap: '10px' }}>
        {/* PF-style "P" lettermark on navy background */}
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '8px',
          background: 'linear-gradient(145deg, #1B2C5E 0%, #0F1E42 100%)',
          border: '1.5px solid rgba(30,86,199,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 18px rgba(11,20,50,0.55), 0 1px 0 rgba(255,255,255,0.06) inset',
        }}>
          {/* Poonawalla Fincorp "P" mark — vertical stem + serif bowl */}
          <svg width="24" height="26" viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Vertical stem */}
            <rect x="2" y="2" width="4.5" height="22" rx="1.5" fill="white"/>
            {/* Bowl outer */}
            <path d="M6.5 2.5 H15.5 Q22 2.5 22 9.5 Q22 16.5 15.5 16.5 H6.5 Z" fill="white"/>
            {/* Bowl inner cutout */}
            <path d="M6.5 6 H14 Q18 6 18 9.5 Q18 13 14 13 H6.5 Z" fill="#1B2C5E"/>
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 className="text-gradient" style={{ fontSize: '1.05rem', lineHeight: 1.2, margin: 0, fontWeight: 800, letterSpacing: '-0.01em' }}>
            PlacementIQ
          </h2>
          <span style={{
            fontSize: '0.6rem',
            color: 'var(--text-muted)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            display: 'block',
            marginTop: '2px',
            textTransform: 'uppercase',
          }}>
            by Poonawalla Fincorp
          </span>
        </div>
      </div>


      {/* Theme Toggle */}
      <button onClick={toggleTheme} className="theme-toggle" style={{ marginBottom: '0.75rem' }}>
        {theme === 'dark'
          ? <Sun size={15} color="#F59E0B" />
          : <Moon size={15} color="#3B82F6" />}
        <span>{theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</span>
      </button>

      <span className="sidebar-section-label">Navigation</span>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(({ path, icon: Icon, label, iconColor, iconBg }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {({ isActive }) => (
              <>
                <div
                  className="nav-icon-wrap"
                  style={isActive ? {
                    background: iconBg,
                    boxShadow: `0 0 12px ${iconBg}`,
                  } : {}}
                >
                  <Icon size={16} color={isActive ? iconColor : undefined} />
                </div>
                <span style={{ fontSize: '0.875rem' }}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* API Status */}
        <div className="api-status-pill">
          <span
            className="pulse-dot"
            style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--risk-low)', display: 'inline-block', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>API Live</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>v2.0 · port 8001 · 10K records</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(16,185,129,0.2)' }}>
            <Zap size={10} color="var(--risk-low)" />
            <span style={{ fontSize: '0.67rem', fontWeight: 700, color: 'var(--risk-low)' }}>5 agents</span>
          </div>
        </div>

        <button
          className="nav-item"
          style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}
        >
          <div className="nav-icon-wrap">
            <LogOut size={15} />
          </div>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Background3D />
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/"          element={<Dashboard />} />
            <Route path="/students"  element={<Dashboard />} />
            <Route path="/student/:id" element={<StudentProfile />} />
            <Route path="/heatmap"   element={<Heatmap />} />
            <Route path="/reports"   element={<Reports />} />
            <Route path="/institutes" element={<Institutes />} />
            <Route path="/agentic"   element={<AgenticInsights />} />
            <Route path="/admin"     element={<Admin />} />
            <Route path="*"          element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
