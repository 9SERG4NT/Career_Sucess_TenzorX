import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Users, TrendingUp, AlertTriangle, Activity, Zap,
  MapPin, BookOpen, Search, RefreshCw, ChevronRight, Brain
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { API_BASE } from '../App';

const RISK_COLORS = { LOW: '#10B981', MEDIUM: '#F59E0B', HIGH: '#EF4444' };
const RISK_ORDER = ['HIGH', 'MEDIUM', 'LOW'];

function StatCard({ icon: Icon, title, value, sub, accentColor }) {
  return (
    <div className="card animate-fade-up interactive-3d-card" style={{ borderTop: `2px solid ${accentColor || 'transparent'}` }}>
      <div className="card-title">
        <Icon size={15} />
        {title}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}


function PlacementVelocityBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label} horizon</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}%</span>
      </div>
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}

function AlertBanner() {
  const [alerts, setAlerts] = useState(null);
  const [shocks, setShocks] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/alerts/active`).then(r => setAlerts(r.data)).catch(() => {});
    axios.get(`${API_BASE}/api/v1/shocks/active`).then(r => setShocks(r.data)).catch(() => {});
  }, []);

  const hasShock = shocks?.shocks?.length > 0;
  const shock = shocks?.shocks?.[0];
  const hasAlerts = alerts?.total > 0;

  if (!hasShock && !hasAlerts) return null;

  return (
    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {hasShock && (
        <div className="alert-banner alert-high">
          <AlertTriangle size={18} color="var(--risk-high)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '0.875rem' }}>
              🚨 Placement Shock — {shock.sector} · {shock.geography?.join(', ')}
            </strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
              {shock.trigger} · <strong style={{ color: 'var(--risk-high)' }}>{shock.affected_students?.toLocaleString()} students affected</strong> · {shock.recommended_action}
            </p>
          </div>
          <span className="badge badge-high" style={{ fontSize: '0.75rem', flexShrink: 0 }}>{shock.severity}</span>
        </div>
      )}
      {hasAlerts && (
        <div className="alert-banner" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
          <AlertTriangle size={16} color="var(--risk-medium)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--risk-medium)' }}>
              ⚡ Early Alert Engine — {alerts.total} Active Alerts
            </strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.1rem' }}>
              🔴 {alerts.critical_count} critical · 🟠 {alerts.high_count} high · 🟡 {alerts.medium_count} medium
              {alerts.alerts?.[0] && ` · Top: ${alerts.alerts[0].student_id} — ${alerts.alerts[0].reason?.slice(0, 60)}`}
            </p>
          </div>
          <span className="badge badge-medium" style={{ fontSize: '0.75rem', flexShrink: 0 }}>{alerts.critical_count} Critical</span>
        </div>
      )}
    </div>
  );
}


function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [sumRes, stuRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/cohort/summary`),
        axios.get(`${API_BASE}/api/v1/students?limit=20`)
      ]);
      setSummary(sumRes.data);
      setStudents(stuRes.data);
      setError(null);
    } catch (err) {
      setError('Cannot reach backend. Ensure the FastAPI server is running on port 8001.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredStudents = students.filter(s => {
    const mockRisk = s.placed_6m === 0 && s.cgpa < 6.0 ? 'HIGH' : s.placed_6m === 1 ? 'LOW' : 'MEDIUM';
    const matchesRisk = filterRisk === 'ALL' || mockRisk === filterRisk;
    const matchesSearch = s.student_id?.toLowerCase().includes(search.toLowerCase()) ||
      s.course_type?.toLowerCase().includes(search.toLowerCase()) ||
      s.region?.toLowerCase().includes(search.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '3rem', color: 'var(--text-secondary)' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      Loading portfolio analytics...
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem' }}>
      <div className="alert-banner alert-high">
        <AlertTriangle size={20} color="var(--risk-high)" />
        <div>
          <strong>Backend Unavailable</strong>
          <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </div>
    </div>
  );

  const pieData = ['HIGH', 'MEDIUM', 'LOW'].map(r => ({
    name: `${r.charAt(0)}${r.slice(1).toLowerCase()} Risk`,
    value: summary.risk_distribution[r],
    color: RISK_COLORS[r]
  }));

  const regionData = Object.entries(summary.top_regions || {}).map(([name, val]) => ({ name, students: val }));
  const courseData = Object.entries(summary.course_breakdown || {}).map(([name, val]) => ({ name, count: val }));

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Portfolio Cohort Dashboard</h1>
          <p>Live risk monitoring across {summary.total_students?.toLocaleString()} active education loan accounts.</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData} disabled={refreshing}>
          <RefreshCw size={15} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Early Alert Engine — Live Banner */}
      <AlertBanner />

      {/* KPI Row */}
      <div className="grid-5 perspective-container" style={{ marginBottom: '1.5rem' }}>
        <StatCard icon={Users} title="Total Portfolio" value={summary.total_students?.toLocaleString()} sub="+2.4% vs last month" accentColor="var(--accent-primary)" />
        <StatCard icon={AlertTriangle} title="High Risk" value={summary.risk_distribution.HIGH?.toLocaleString()} sub="Requires immediate action" accentColor="var(--risk-high)" />
        <StatCard icon={Activity} title="6M Velocity" value={`${summary.placement_velocity?.['6m']}%`} sub="Avg placement probability" accentColor="var(--risk-medium)" />
        <StatCard icon={TrendingUp} title="Avg CGPA" value={summary.avg_cgpa} sub={`Avg EMI: ₹${summary.avg_emi?.toLocaleString()}`} accentColor="var(--risk-low)" />
        <StatCard icon={Brain} title="AI Agents" value="5 Active" sub="NBA · Explainability · Market · Career · Offer" accentColor="var(--accent-purple)" />
      </div>

      {/* Charts Row */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {/* Risk Donut */}
        <div className="card">
          <div className="card-title"><Zap size={14} /> Risk Distribution</div>
          <div style={{ height: '200px', minHeight: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.82rem' }} itemStyle={{ color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                  {d.name}
                </div>
                <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{d.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Placement Velocity */}
        <div className="card">
          <div className="card-title"><Activity size={14} /> Placement Velocity</div>
          <div style={{ paddingTop: '0.5rem' }}>
            <PlacementVelocityBar label="3-month" value={summary.placement_velocity?.['3m']} color="#EF4444" />
            <PlacementVelocityBar label="6-month" value={summary.placement_velocity?.['6m']} color="#F59E0B" />
            <PlacementVelocityBar label="12-month" value={summary.placement_velocity?.['12m']} color="#10B981" />
          </div>
          <hr className="divider" />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Based on {summary.total_students?.toLocaleString()} active student records
          </div>
        </div>

        {/* Region & Course Breakdown */}
        <div className="card">
          <div className="card-title"><MapPin size={14} /> Top Regions</div>
          <div style={{ height: '140px', minHeight: '140px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Bar dataKey="students" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <hr className="divider" />
          <div className="card-title" style={{ marginBottom: '0.5rem' }}><BookOpen size={14} /> Course Mix</div>
          {courseData.map(c => (
            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
              <span style={{ fontWeight: 600 }}>{c.count?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Student Watchlist */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h3>Priority Student Watchlist</h3>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="select-input"
                style={{ paddingLeft: '2rem', width: '200px' }}
              />
            </div>
            {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(r => (
              <button key={r} onClick={() => setFilterRisk(r)}
                className={`badge ${r === 'ALL' ? 'badge-info' : `badge-${r.toLowerCase()}`}`}
                style={{ cursor: 'pointer', border: filterRisk === r ? '2px solid currentColor' : '1px solid transparent', background: filterRisk === r ? undefined : 'transparent', opacity: filterRisk === r ? 1 : 0.6 }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Course · Tier · Region</th>
                <th>CGPA</th>
                <th>Monthly EMI</th>
                <th>Placed 6m</th>
                <th>Risk</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No students match filters.</td></tr>
              ) : filteredStudents.map(s => {
                const mockRisk = s.placed_6m === 0 && s.cgpa < 6.0 ? 'HIGH' : s.placed_6m === 1 ? 'LOW' : 'MEDIUM';
                return (
                  <tr key={s.student_id}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.82rem' }}>{s.student_id}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.course_type}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Tier {s.institute_tier} · {s.region}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.cgpa}</td>
                    <td>₹{s.monthly_emi?.toLocaleString()}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: s.placed_6m ? 'var(--risk-low)' : 'var(--text-muted)' }}>
                        {s.placed_6m ? '✓ Placed' : '✗ Not yet'}
                      </span>
                    </td>
                    <td><span className={`badge badge-${mockRisk.toLowerCase()}`}>{mockRisk}</span></td>
                    <td>
                      <Link to={`/student/${s.student_id}`} className="btn btn-ghost" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                        Analyze <ChevronRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
