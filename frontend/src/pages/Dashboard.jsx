import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Users, TrendingUp, AlertTriangle, Activity, Zap,
  MapPin, BookOpen, Search, RefreshCw, ChevronRight, Brain
} from 'lucide-react';
import {
  PieChart, Pie, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { API_BASE } from '../App';

const RISK_COLORS = { LOW: '#10B981', MEDIUM: '#F59E0B', HIGH: '#EF4444' };

function StatCard({ icon: Icon, iconClass, accentColor, title, value, sub }) {
  return (
    <div
      className="card card-sm interactive-3d-card animate-fade-up"
      style={{ borderTop: `2px solid ${accentColor}` }}
    >
      <div className={`stat-icon-wrap ${iconClass}`}>
        <Icon size={18} color={accentColor} />
      </div>
      <div className="card-title" style={{ marginBottom: '0.4rem' }}>{title}</div>
      <div className="stat-value" style={{ color: accentColor }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function PlacementVelocityBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label} horizon</span>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color }}>{value}%</span>
      </div>
      <div className="progress-bar-track" style={{ height: '8px' }}>
        <div
          className="progress-bar-fill"
          style={{
            width: `${value}%`,
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
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
    <div style={{ marginBottom: '1.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {hasShock && (
        <div
          className="alert-banner alert-high"
          style={{ animation: 'borderGlow 3s ease-in-out infinite' }}
        >
          <AlertTriangle size={18} color="var(--risk-high)" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '0.9rem', color: 'var(--risk-high)' }}>
              Placement Shock — {shock.sector} · {shock.geography?.join(', ')}
            </strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
              {shock.trigger} ·{' '}
              <strong style={{ color: 'var(--risk-high)' }}>
                {shock.affected_students?.toLocaleString()} students affected
              </strong>{' '}
              · {shock.recommended_action}
            </p>
          </div>
          <span className="badge badge-high" style={{ flexShrink: 0 }}>{shock.severity}</span>
        </div>
      )}
      {hasAlerts && (
        <div
          className="alert-banner"
          style={{
            background: 'rgba(245,158,11,0.05)',
            border: '1px solid rgba(245,158,11,0.25)',
            borderLeftColor: 'var(--risk-medium)',
          }}
        >
          <AlertTriangle size={16} color="var(--risk-medium)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: '0.875rem', color: 'var(--risk-medium)' }}>
              Early Alert Engine — {alerts.total} Active Alerts
            </strong>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.15rem' }}>
              {alerts.critical_count} critical · {alerts.high_count} high · {alerts.medium_count} medium
              {alerts.alerts?.[0] && ` · ${alerts.alerts[0].student_id} — ${alerts.alerts[0].reason?.slice(0, 55)}`}
            </p>
          </div>
          <span className="badge badge-medium" style={{ flexShrink: 0 }}>{alerts.critical_count} Critical</span>
        </div>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
      padding: '0.75rem 1rem',
      fontSize: '0.82rem',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontSize: '0.75rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text-primary)', fontWeight: 600 }}>
          {p.value?.toLocaleString()} {p.name}
        </div>
      ))}
    </div>
  );
};

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
        axios.get(`${API_BASE}/api/v1/students?limit=20`),
      ]);
      setSummary(sumRes.data);
      setStudents(stuRes.data);
      setError(null);
    } catch {
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
    const matchesSearch =
      s.student_id?.toLowerCase().includes(search.toLowerCase()) ||
      s.course_type?.toLowerCase().includes(search.toLowerCase()) ||
      s.region?.toLowerCase().includes(search.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
      <span style={{ fontSize: '0.9rem' }}>Loading portfolio analytics...</span>
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem' }}>
      <div className="alert-banner alert-high">
        <AlertTriangle size={20} color="var(--risk-high)" />
        <div>
          <strong>Backend Unavailable</strong>
          <p style={{ marginTop: '0.25rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    </div>
  );

  const pieData = ['HIGH', 'MEDIUM', 'LOW'].map(r => ({
    name: `${r.charAt(0)}${r.slice(1).toLowerCase()} Risk`,
    value: summary.risk_distribution[r],
    color: RISK_COLORS[r],
    fill: RISK_COLORS[r],
  }));

  const regionData = Object.entries(summary.top_regions || {}).map(([name, val], i) => ({
    name, students: val,
    fill: `hsl(${210 + i * 22}, 75%, 58%)`,
  }));
  const courseData = Object.entries(summary.course_breakdown || {}).map(([name, val]) => ({ name, count: val }));

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Portfolio Cohort Dashboard</h1>
          <p>
            Live risk monitoring across{' '}
            <strong style={{ color: 'var(--accent-primary)' }}>{summary.total_students?.toLocaleString()}</strong>
            {' '}active education loan accounts.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData} disabled={refreshing}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Alert Banners */}
      <AlertBanner />

      {/* KPI Row */}
      <div className="grid-5 perspective-container" style={{ marginBottom: '1.75rem' }}>
        <StatCard
          icon={Users} iconClass="stat-icon-blue" accentColor="#3B82F6"
          title="Total Portfolio"
          value={summary.total_students?.toLocaleString()}
          sub="+2.4% vs last month"
        />
        <StatCard
          icon={AlertTriangle} iconClass="stat-icon-red" accentColor="#EF4444"
          title="High Risk"
          value={summary.risk_distribution.HIGH?.toLocaleString()}
          sub="Requires immediate action"
        />
        <StatCard
          icon={Activity} iconClass="stat-icon-amber" accentColor="#F59E0B"
          title="6M Velocity"
          value={`${summary.placement_velocity?.['6m']}%`}
          sub="Avg placement probability"
        />
        <StatCard
          icon={TrendingUp} iconClass="stat-icon-green" accentColor="#10B981"
          title="Avg CGPA"
          value={summary.avg_cgpa}
          sub={`Avg EMI: ₹${summary.avg_emi?.toLocaleString()}`}
        />
        <StatCard
          icon={Brain} iconClass="stat-icon-purple" accentColor="#8B5CF6"
          title="AI Agents"
          value="5 Active"
          sub="NBA · Explainability · Market"
        />
      </div>

      {/* Charts Row */}
      <div className="grid-3" style={{ marginBottom: '1.75rem' }}>
        {/* Risk Donut */}
        <div className="card">
          <div className="card-title"><Zap size={13} /> Risk Distribution</div>
          <div style={{ height: '190px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={52} outerRadius={78}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                />
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: d.color, display: 'inline-block', boxShadow: `0 0 6px ${d.color}80` }} />
                  {d.name}
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: d.color }}>{d.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Placement Velocity */}
        <div className="card">
          <div className="card-title"><Activity size={13} /> Placement Velocity</div>
          <div style={{ paddingTop: '0.5rem' }}>
            <PlacementVelocityBar label="3-month"  value={summary.placement_velocity?.['3m']}  color="#EF4444" />
            <PlacementVelocityBar label="6-month"  value={summary.placement_velocity?.['6m']}  color="#F59E0B" />
            <PlacementVelocityBar label="12-month" value={summary.placement_velocity?.['12m']} color="#10B981" />
          </div>
          <hr className="divider" />
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Based on <strong>{summary.total_students?.toLocaleString()}</strong> active student records
          </div>
        </div>

        {/* Region & Course */}
        <div className="card">
          <div className="card-title"><MapPin size={13} /> Top Regions</div>
          <div style={{ height: '145px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="students" radius={[5, 5, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <hr className="divider" />
          <div className="card-title" style={{ marginBottom: '0.5rem' }}><BookOpen size={13} /> Course Mix</div>
          {courseData.map(c => (
            <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{c.name}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.count?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Student Watchlist */}
      <div className="card">
        <div className="section-header">
          <h3>Priority Student Watchlist</h3>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="select-input"
                style={{ paddingLeft: '2rem', width: '190px', fontSize: '0.82rem' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(r => (
                <button
                  key={r}
                  onClick={() => setFilterRisk(r)}
                  className={`badge ${r === 'ALL' ? 'badge-info' : `badge-${r.toLowerCase()}`}`}
                  style={{
                    cursor: 'pointer',
                    opacity: filterRisk === r ? 1 : 0.5,
                    transform: filterRisk === r ? 'scale(1.05)' : 'scale(1)',
                    transition: 'all 0.15s',
                    border: filterRisk === r ? '2px solid currentColor' : undefined,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
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
                <th>Risk Band</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>
                    No students match the current filters.
                  </td>
                </tr>
              ) : filteredStudents.map(s => {
                const mockRisk = s.placed_6m === 0 && s.cgpa < 6.0 ? 'HIGH' : s.placed_6m === 1 ? 'LOW' : 'MEDIUM';
                const riskColor = RISK_COLORS[mockRisk];
                return (
                  <tr key={s.student_id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-primary)' }}>
                      {s.student_id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{s.course_type}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Tier {s.institute_tier} · {s.region}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: s.cgpa >= 7 ? 'var(--risk-low)' : s.cgpa >= 5.5 ? 'var(--risk-medium)' : 'var(--risk-high)' }}>
                        {s.cgpa}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>₹{s.monthly_emi?.toLocaleString()}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        fontSize: '0.8rem', fontWeight: 600,
                        color: s.placed_6m ? 'var(--risk-low)' : 'var(--text-muted)',
                      }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: s.placed_6m ? 'var(--risk-low)' : 'var(--text-muted)',
                          display: 'inline-block',
                        }} />
                        {s.placed_6m ? 'Placed' : 'Not yet'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge badge-${mockRisk.toLowerCase()}`}
                        style={{ boxShadow: `0 0 10px ${riskColor}30` }}
                      >
                        {mockRisk}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/student/${s.student_id}`}
                        className="btn btn-ghost"
                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}
                      >
                        Analyze <ChevronRight size={12} />
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
