import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, BarChart3, BookOpen, LogOut, Building2, Settings } from 'lucide-react';
import './App.css';
import Dashboard from './pages/Dashboard';
import StudentProfile from './pages/StudentProfile';
import Heatmap from './pages/Heatmap';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Institutes from './pages/Institutes';

const API_BASE = 'http://localhost:8001';
export { API_BASE };

function Sidebar() {
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/students', icon: Users, label: 'Portfolio' },
    { path: '/heatmap', icon: BarChart3, label: 'Heatmap ⭐' },
    { path: '/reports', icon: BookOpen, label: 'Reports & Drift' },
    { path: '/institutes', icon: Building2, label: 'Institutes ⭐' },
    { path: '/admin', icon: Settings, label: 'Admin Panel (F-12)' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">PIQ</div>
        <h2 className="text-gradient">PlacementIQ</h2>
      </div>

      <span className="sidebar-section-label">Navigation</span>

      <nav>
        {navItems.map(({ path, icon: Icon, label }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
            <span className="pulse-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--risk-low)', display: 'inline-block' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>API Live</span>
          </div>
          <p style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>v2.0 · port 8001 · 10K records</p>
        </div>
        <button className="nav-item" style={{ border: 'none', background: 'none', cursor: 'pointer', width: '100%', color: 'var(--text-secondary)' }}>
          <LogOut size={17} />
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
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/students" element={<Dashboard />} />
            <Route path="/student/:id" element={<StudentProfile />} />
            <Route path="/heatmap" element={<Heatmap />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/institutes" element={<Institutes />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;


