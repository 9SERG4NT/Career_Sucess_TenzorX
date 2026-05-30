import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Users, TrendingUp, AlertTriangle, Activity, Zap,
  MapPin, BookOpen, Search, RefreshCw, ChevronRight, Brain,
  IndianRupee, ShieldAlert, Wallet, TrendingDown,
} from 'lucide-react';
import {
  PieChart, Pie, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { API_BASE } from '../App';

// Editorial risk palette — deep tones for paper
const RISK_COLORS = { LOW: '#2F6E45', MEDIUM: '#A5751F', HIGH: '#A82828' };

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function StatCard({ icon: Icon, iconClass, accentColor, title, value, sub, index = 0 }) {
  return (
    <div
      className="card card-sm interactive-3d-card"
      style={{
        position: 'relative',
        borderTop: `2px solid ${accentColor}`,
        paddingTop: '1.55rem',
      }}
    >
      {/* Editorial serial — italic serif numeral, top-right */}
      <span
        className="serial"
        style={{
          position: 'absolute',
          top: '0.85rem',
          right: '1rem',
          fontSize: '0.78rem',
          margin: 0,
        }}
      >
        № {ROMAN[index]}
      </span>

      <div className={`stat-icon-wrap ${iconClass}`}>
        <Icon size={16} />
      </div>
      <div className="card-title" style={{ marginBottom: '0.5rem' }}>{title}</div>
      <div className="stat-value" style={{ color: 'var(--ink)' }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function PlacementVelocityBar({ label, value, color }) {
  return (
    <div style={{ marginBottom: '1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.45rem' }}>
        <span style={{
          fontSize: '0.72rem',
          color: 'var(--ink-muted)',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>{label} horizon</span>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.4rem',
          fontWeight: 400,
          fontVariationSettings: '"opsz" 72',
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
          fontFeatureSettings: '"tnum"',
        }}>{value}<span style={{ fontSize: '0.8rem', color: 'var(--ink-faint)', marginLeft: '2px' }}>%</span></span>
      </div>
      <div className="progress-bar-track" style={{ height: '6px' }}>
        <div
          className="progress-bar-fill"
          style={{
            width: `${value}%`,
            background: color,
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
      background: 'var(--card-raised)',
      border: '1px solid var(--card-edge-strong)',
      borderLeft: '3px solid var(--signal)',
      borderRadius: '2px',
      padding: '0.7rem 0.95rem',
      fontFamily: 'var(--font-sans)',
      fontSize: '0.78rem',
      boxShadow: 'var(--shadow-raised)',
      minWidth: '140px',
    }}>
      <div style={{
        color: 'var(--ink-faint)',
        marginBottom: '6px',
        fontSize: '0.62rem',
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{
          color: p.color || 'var(--ink)',
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.86rem',
        }}>
          {p.value?.toLocaleString()} <span style={{ color: 'var(--ink-muted)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>{p.name}</span>
        </div>
      ))}
    </div>
  );
};

// Helper: format INR amount as "₹X.XX Cr" or "₹X.XX L"
function fmtINR(n) {
  if (!n || n < 0) return '₹0';
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function PortfolioHero({ portfolio }) {
  if (!portfolio) return null;
  const atRiskColor = portfolio.at_risk_pct > 20 ? 'var(--risk-high)'
                    : portfolio.at_risk_pct > 12 ? 'var(--risk-medium)'
                    : 'var(--risk-low)';
  return (
    <>
      <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)', marginTop: '1.75rem' }}>
        <span style={{ marginRight: '0.5em' }}>02 — Portfolio Economics</span>
      </div>
      <div className="grid-4 portfolio-hero-grid" style={{ marginBottom: '1.75rem' }}>
        <StatCard
          index={0}
          icon={Wallet} iconClass="stat-icon-blue" accentColor="#1B2C5E"
          title="Total Disbursed"
          value={fmtINR(portfolio.total_disbursed_inr)}
          sub={`${portfolio.total_students?.toLocaleString()} active loans`}
        />
        <StatCard
          index={1}
          icon={IndianRupee} iconClass="stat-icon-green" accentColor="#2F6E45"
          title="Assets Under Mgmt"
          value={fmtINR(portfolio.aum_inr)}
          sub="~85% of book outstanding"
        />
        <StatCard
          index={2}
          icon={ShieldAlert} iconClass="stat-icon-red" accentColor={atRiskColor}
          title="At-Risk Principal"
          value={fmtINR(portfolio.at_risk_amount_inr)}
          sub={`${portfolio.at_risk_pct}% of book in HIGH band`}
        />
        <StatCard
          index={3}
          icon={TrendingDown} iconClass="stat-icon-amber" accentColor="#A5751F"
          title="Projected Loss · 12M"
          value={fmtINR(portfolio.projected_loss_inr)}
          sub={`${portfolio.projected_default_rate_pct}% weighted default rate`}
        />
      </div>

      {/* Composition + Top at-risk */}
      <div className="grid-2" style={{ marginBottom: '1.75rem' }}>
        <div className="card">
          <div className="card-title"><MapPin size={13} /> Portfolio by Institute Tier</div>
          <div style={{ marginTop: '0.75rem' }}>
            {Object.entries(portfolio.composition?.by_tier || {}).map(([tier, info]) => {
              const pct = portfolio.total_disbursed_inr > 0 ? (info.amount_inr / portfolio.total_disbursed_inr * 100) : 0;
              return (
                <div key={tier} style={{ marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--ink-soft)', fontWeight: 600 }}>Tier {tier}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600 }}>
                      {fmtINR(info.amount_inr)} <span style={{ color: 'var(--ink-faint)', marginLeft: '4px' }}>({info.count?.toLocaleString()})</span>
                    </span>
                  </div>
                  <div className="progress-bar-track" style={{ height: '5px' }}>
                    <div className="progress-bar-fill" style={{ width: `${pct}%`, background: '#1B2C5E' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-title"><AlertTriangle size={13} /> Top 5 at-risk loans</div>
          <div style={{ marginTop: '0.5rem' }}>
            {(portfolio.top_at_risk_students || []).map((s) => (
              <Link key={s.student_id} to={`/student/${s.student_id}`} style={{ textDecoration: 'none' }}>
                <div className="top-risk-row">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--ink)' }}>
                      {s.student_id}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '2px' }}>
                      {s.course_type} · {s.region} · CGPA {s.cgpa}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--risk-high)', fontStyle: 'italic', marginTop: '2px' }}>
                      {s.primary_risk_factor}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontWeight: 600, fontSize: '0.86rem' }}>
                      {fmtINR(s.loan_amount_inr)}
                    </div>
                    <span className="badge badge-high" style={{ fontSize: '0.65rem', marginTop: '3px' }}>HIGH</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [sumRes, stuRes, pfRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/cohort/summary`),
        axios.get(`${API_BASE}/api/v1/students?limit=20`),
        axios.get(`${API_BASE}/api/v1/portfolio/summary`).catch(() => ({ data: null })),
      ]);
      setSummary(sumRes.data);
      setStudents(stuRes.data);
      setPortfolio(pfRes.data);
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

  // Navy monochrome ramp — single hue ladder, editorial restraint
  const NAVY_RAMP = ['#0F1A3D', '#1B2C5E', '#2A4593', '#3960C9', '#5B7FD9', '#7E9DE3'];
  const regionData = Object.entries(summary.top_regions || {}).map(([name, val], i) => ({
    name, students: val,
    fill: NAVY_RAMP[i % NAVY_RAMP.length],
  }));
  const courseData = Object.entries(summary.course_breakdown || {}).map(([name, val]) => ({ name, count: val }));

  return (
    <div className="animate-fade-up">
      {/* Header — editorial masthead */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>01</span>
            Cohort Intelligence
          </div>
          <h1>Portfolio Cohort Dashboard</h1>
          <p style={{ marginTop: '0.55rem' }}>
            Live risk monitoring across{' '}
            <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>
              {summary.total_students?.toLocaleString()}
            </span>
            {' '}active education loan accounts. Updated continuously from market signals.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData} disabled={refreshing}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Alert Banners */}
      <AlertBanner />

      {/* KPI Row */}
      <div className="grid-5 perspective-container" style={{ marginBottom: '2.25rem' }}>
        <StatCard
          index={0}
          icon={Users} iconClass="stat-icon-blue" accentColor="#1B2C5E"
          title="Total Portfolio"
          value={summary.total_students?.toLocaleString()}
          sub="+2.4% vs last month"
        />
        <StatCard
          index={1}
          icon={AlertTriangle} iconClass="stat-icon-red" accentColor="#A82828"
          title="High Risk"
          value={summary.risk_distribution.HIGH?.toLocaleString()}
          sub="Requires immediate action"
        />
        <StatCard
          index={2}
          icon={Activity} iconClass="stat-icon-amber" accentColor="#A5751F"
          title="6M Velocity"
          value={`${summary.placement_velocity?.['6m']}%`}
          sub="Avg placement probability"
        />
        <StatCard
          index={3}
          icon={TrendingUp} iconClass="stat-icon-green" accentColor="#2F6E45"
          title="Avg CGPA"
          value={summary.avg_cgpa}
          sub={`Avg EMI: ₹${summary.avg_emi?.toLocaleString()}`}
        />
        <StatCard
          index={4}
          icon={Brain} iconClass="stat-icon-purple" accentColor="#C2410C"
          title="AI Agents"
          value="5 Active"
          sub="NBA · Explainability · Market"
        />
      </div>

      {/* Portfolio Economics Hero — disbursed, AUM, at-risk, projected loss */}
      <PortfolioHero portfolio={portfolio} />

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.75rem', borderTop: '1px solid var(--rule)', paddingTop: '0.85rem' }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                  <span style={{ width: '2px', height: '14px', background: d.color, display: 'inline-block' }} />
                  {d.name}
                </div>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  color: 'var(--ink)',
                  fontFeatureSettings: '"tnum"',
                }}>{d.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Placement Velocity */}
        <div className="card">
          <div className="card-title"><Activity size={13} /> Placement Velocity</div>
          <div style={{ paddingTop: '0.5rem' }}>
            <PlacementVelocityBar label="3-month"  value={summary.placement_velocity?.['3m']}  color="#A82828" />
            <PlacementVelocityBar label="6-month"  value={summary.placement_velocity?.['6m']}  color="#A5751F" />
            <PlacementVelocityBar label="12-month" value={summary.placement_velocity?.['12m']} color="#2F6E45" />
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
                <CartesianGrid strokeDasharray="2 4" stroke="var(--rule)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--ink-muted)', fontSize: 10, fontFamily: 'var(--font-sans)' }}
                  axisLine={{ stroke: 'var(--rule-strong)' }} tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--ink-faint)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(27, 44, 94, 0.05)' }} />
                <Bar dataKey="students" radius={[1, 1, 0, 0]} opacity={1} />
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
          <div>
            <div className="eyebrow" style={{ marginBottom: '0.4rem', color: 'var(--signal)' }}>02 — Watchlist</div>
            <h3>Priority Student Watchlist</h3>
          </div>
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
                return (
                  <tr key={s.student_id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: '0.78rem', color: 'var(--navy)', letterSpacing: '-0.01em' }}>
                      {s.student_id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.88rem' }}>{s.course_type}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', marginTop: '3px', letterSpacing: '0.04em' }}>
                        Tier {s.institute_tier} · {s.region}
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 400,
                        fontVariationSettings: '"opsz" 48',
                        fontSize: '1.15rem',
                        letterSpacing: '-0.02em',
                        color: s.cgpa >= 7 ? 'var(--risk-low)' : s.cgpa >= 5.5 ? 'var(--risk-medium)' : 'var(--risk-high)',
                      }}>
                        {s.cgpa}
                      </span>
                    </td>
                    <td style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontFeatureSettings: '"tnum"' }}>
                      ₹{s.monthly_emi?.toLocaleString()}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                        fontSize: '0.78rem', fontWeight: 600,
                        color: s.placed_6m ? 'var(--risk-low)' : 'var(--ink-faint)',
                        letterSpacing: '0.02em',
                      }}>
                        <span style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: s.placed_6m ? 'var(--risk-low)' : 'var(--ink-faint)',
                          display: 'inline-block',
                        }} />
                        {s.placed_6m ? 'Placed' : 'Not yet'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${mockRisk.toLowerCase()}`}>
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
