import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Bell, AlertTriangle, TrendingDown, RefreshCw, ChevronRight, ShieldAlert, Activity,
} from 'lucide-react';
import { API_BASE } from '../App';

function SummaryStat({ icon: Icon, label, value, color }) {
  return (
    <div className="card card-sm" style={{ borderTop: `2px solid ${color}` }}>
      <div className="stat-icon-wrap" style={{ color, borderColor: color, background: 'transparent' }}>
        <Icon size={16} />
      </div>
      <div className="card-title" style={{ marginBottom: '0.4rem' }}>{label}</div>
      <div className="stat-value" style={{ fontSize: '2.1rem' }}>{value}</div>
    </div>
  );
}

export default function Alerts() {
  const [alerts, setAlerts] = useState(null);
  const [shocks, setShocks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [severity, setSeverity] = useState('ALL');

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [aRes, sRes] = await Promise.all([
        axios.get(`${API_BASE}/api/v1/alerts/active`).catch(() => ({ data: null })),
        axios.get(`${API_BASE}/api/v1/shocks/active`).catch(() => ({ data: null })),
      ]);
      setAlerts(aRes.data);
      setShocks(sRes.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
      <span style={{ fontSize: '0.9rem' }}>Loading alerts &amp; signals...</span>
    </div>
  );

  const shockList = shocks?.shocks || [];
  const alertList = alerts?.alerts || [];
  const filteredAlerts = severity === 'ALL' ? alertList : alertList.filter(a => a.severity === severity);

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>00</span> Notification Center
          </div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Bell size={26} color="var(--risk-high)" /> Alerts &amp; Signals
          </h1>
          <p style={{ marginTop: '0.55rem' }}>
            Live macro-level placement shocks and the early-alert engine for borrowers crossing into high risk.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData} disabled={refreshing}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <SummaryStat icon={TrendingDown} label="Active Shocks" value={shockList.length} color="#A82828" />
        <SummaryStat icon={ShieldAlert} label="Critical Alerts" value={alerts?.critical_count ?? 0} color="#A82828" />
        <SummaryStat icon={AlertTriangle} label="High Alerts" value={alerts?.high_count ?? 0} color="#A5751F" />
        <SummaryStat icon={Activity} label="Total Active" value={alerts?.total ?? 0} color="#1B2C5E" />
      </div>

      {/* Active market shocks */}
      <div className="card" style={{ marginBottom: '1.75rem' }}>
        <div className="card-title"><TrendingDown size={13} /> Active Market Shocks</div>
        {shockList.length === 0 ? (
          <div style={{ padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No active placement shocks detected. Market sentiment: <strong>{shocks?.overall_sentiment || 'STABLE'}</strong>.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            {shockList.map((s) => (
              <div key={s.shock_id} className="alert-banner alert-high" style={{ marginBottom: 0 }}>
                <AlertTriangle size={18} color="var(--risk-high)" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--risk-high)' }}>
                    {s.sector} · {(s.geography || []).join(', ')}
                  </strong>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '0.25rem', lineHeight: 1.5 }}>
                    {s.trigger} · <strong style={{ color: 'var(--risk-high)' }}>{s.affected_students?.toLocaleString()} students affected</strong> · {s.recommended_action}
                  </p>
                </div>
                <span className="badge badge-high" style={{ flexShrink: 0 }}>{s.severity}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Early alert engine */}
      <div className="card">
        <div className="section-header">
          <div>
            <div className="eyebrow" style={{ marginBottom: '0.4rem', color: 'var(--signal)' }}>Early Alert Engine</div>
            <h3>Borrowers Requiring Intervention</h3>
          </div>
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(r => (
              <button
                key={r}
                onClick={() => setSeverity(r)}
                className={`badge ${r === 'ALL' ? 'badge-info' : r === 'CRITICAL' || r === 'HIGH' ? 'badge-high' : 'badge-medium'}`}
                style={{ cursor: 'pointer', opacity: severity === r ? 1 : 0.5, border: severity === r ? '2px solid currentColor' : undefined }}
              >
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
                <th>Severity</th>
                <th>Reason</th>
                <th>Course · Tier · Region</th>
                <th>Recommended Action</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAlerts.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem' }}>No alerts at this severity.</td></tr>
              ) : filteredAlerts.map((a) => (
                <tr key={a.student_id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, fontSize: '0.78rem', color: 'var(--navy)' }}>{a.student_id}</td>
                  <td><span className={`badge badge-${a.severity === 'MEDIUM' ? 'medium' : 'high'}`}>{a.severity}</span></td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{a.reason}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>{a.course_type} · Tier {a.institute_tier} · {a.region}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{a.recommended_action}</td>
                  <td>
                    <Link to={`/student/${a.student_id}`} className="btn btn-ghost" style={{ padding: '0.3rem 0.75rem', fontSize: '0.78rem' }}>
                      Analyze <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
