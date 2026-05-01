import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Building2, TrendingUp, TrendingDown, Minus, AlertTriangle, RefreshCw, Zap, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { API_BASE } from '../App';

// ─── Institute Momentum Panel ─────────────────────────────────────────────
function MomentumPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/institutes/momentum`)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '1rem', color: 'var(--text-secondary)' }}><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />Loading...</div>;
  if (!data) return null;

  const chartData = data.institutes?.map(i => ({
    name: i.name.length > 15 ? i.name.slice(0, 15) + '…' : i.name,
    ratio: i.momentum_ratio,
    status: i.momentum_status,
  }));

  return (
    <div>
      {data.declining_count > 0 && (
        <div className="alert-banner alert-high" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={14} />
          <span style={{ fontSize: '0.82rem' }}>{data.declining_count} institute(s) in DECLINING momentum — tier score adjustments applied automatically.</span>
        </div>
      )}
      <div style={{ height: '200px', marginBottom: '1.5rem' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
            <XAxis type="number" domain={[0, 2]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem' }}
              formatter={(v, _, p) => [`${v} (${p.payload.status})`, 'Momentum Ratio']}
              labelStyle={{ color: 'var(--text-secondary)' }}
            />
            <Bar dataKey="ratio" radius={[0, 4, 4, 0]}>
              {chartData?.map((entry, i) => (
                <Cell key={i} fill={
                  entry.status === 'STRONG' ? 'var(--risk-low)' :
                  entry.status === 'DECLINING' ? 'var(--risk-high)' : 'var(--risk-medium)'
                } />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="data-table">
        <thead>
          <tr><th>Institute</th><th>Tier</th><th>Region</th><th>Recruiter Visits 30d</th><th>Offers 30d</th><th>Ratio</th><th>Status</th><th>Adj</th></tr>
        </thead>
        <tbody>
          {data.institutes?.map((inst, i) => (
            <tr key={i}>
              <td style={{ fontWeight: 500 }}>{inst.name}</td>
              <td><span className={`badge badge-${inst.tier === 'A' ? 'low' : inst.tier === 'B' ? 'medium' : 'high'}`}>{inst.tier}</span></td>
              <td>{inst.region}</td>
              <td>{inst.recruiter_visits_30d}</td>
              <td>{inst.offers_30d}</td>
              <td style={{ fontWeight: 700, color: inst.momentum_status === 'STRONG' ? 'var(--risk-low)' : inst.momentum_status === 'DECLINING' ? 'var(--risk-high)' : 'var(--risk-medium)' }}>{inst.momentum_ratio}x</td>
              <td>
                <span className={`badge badge-${inst.momentum_status === 'STRONG' ? 'low' : inst.momentum_status === 'DECLINING' ? 'high' : 'medium'}`}>
                  {inst.momentum_status === 'STRONG' ? <TrendingUp size={10} /> : inst.momentum_status === 'DECLINING' ? <TrendingDown size={10} /> : <Minus size={10} />}
                  {' '}{inst.momentum_status}
                </span>
              </td>
              <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: inst.tier_score_adjustment.startsWith('+') ? 'var(--risk-low)' : inst.tier_score_adjustment === '0%' ? 'var(--text-muted)' : 'var(--risk-high)' }}>{inst.tier_score_adjustment}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Peer Velocity Panel ──────────────────────────────────────────────────
function VelocityPanel() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const fetch = (courseType) => {
    setLoading(true);
    const params = courseType !== 'ALL' ? { course_type: courseType } : {};
    axios.get(`${API_BASE}/api/v1/cohort/velocity`, { params })
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch('ALL'); }, []);

  const alertColors = {
    RED: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: 'var(--risk-high)', label: '🔴 Critical' },
    ORANGE: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', text: '#F97316', label: '🟠 Urgent' },
    YELLOW: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: 'var(--risk-medium)', label: '🟡 Monitor' },
    NORMAL: { bg: 'rgba(255,255,255,0.02)', border: 'var(--border-color)', text: 'var(--text-muted)', label: '⚪ Normal' },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'Engineering', 'MBA', 'Nursing'].map(f => (
          <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`}
            style={{ flex: 'none', padding: '0.35rem 0.75rem' }}
            onClick={() => { setFilter(f); fetch(f); }}>
            {f}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />Loading...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {data?.cohorts?.map((c, i) => {
            const col = alertColors[c.alert_tier] || alertColors.NORMAL;
            return (
              <div key={i} style={{ padding: '0.9rem', borderRadius: '10px', background: col.bg, border: `1px solid ${col.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.cohort}</div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: col.text }}>{col.label}</span>
                </div>
                <div className="progress-bar-track" style={{ marginBottom: '0.4rem' }}>
                  <div className="progress-bar-fill" style={{ width: `${c.placement_rate * 100}%`, background: col.text }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>{c.placed_count} / {c.total_students} placed</span>
                  <span style={{ fontWeight: 700, color: col.text }}>{(c.placement_rate * 100).toFixed(0)}%</span>
                </div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: col.text }}>{c.alert_message}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Cold-Start Panel ─────────────────────────────────────────────────────
function ColdStartPanel() {
  const [form, setForm] = useState({ institute_name: 'New Engineering College, Pune', naac_grade: 'B+', city_tier: 2 });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/institute/cold-start`, form);
      setResult(res.data);
    } catch { setResult({ error: 'Failed' }); }
    setLoading(false);
  };

  return (
    <div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        KNN-based synthetic scoring for new institutes without historical placement data. (PRD §10.7)
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Institute Name</label>
          <input className="select-input" value={form.institute_name} onChange={e => setForm(f => ({ ...f, institute_name: e.target.value }))} />
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>NAAC Grade</label>
          <select className="select-input" value={form.naac_grade} onChange={e => setForm(f => ({ ...f, naac_grade: e.target.value }))}>
            {['A++', 'A+', 'A', 'B+', 'B', 'C'].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>City Tier (1–4)</label>
          <input type="number" min={1} max={4} className="select-input" value={form.city_tier} onChange={e => setForm(f => ({ ...f, city_tier: parseInt(e.target.value) }))} />
        </div>
      </div>
      <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ marginBottom: '1.25rem' }}>
        {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
        {loading ? 'Computing...' : 'Compute Cold-Start Score'}
      </button>
      {result && !result.error && (
        <div style={{ padding: '1rem', borderRadius: '10px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Synthetic Placement Rate</div><div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--accent-primary)' }}>{(result.synthetic_placement_rate * 100).toFixed(1)}%</div></div>
            <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Avg Salary Estimate</div><div style={{ fontWeight: 800, fontSize: '1.4rem', color: 'var(--risk-low)' }}>₹{result.synthetic_avg_salary_inr?.toLocaleString()}</div></div>
            <div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Confidence Ceiling</div><div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--risk-medium)' }}>{result.confidence_ceiling}</div></div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>K-Nearest Institutes:</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {result.k_nearest_institutes?.map((k, i) => (
              <span key={i} style={{ padding: '0.25rem 0.7rem', borderRadius: '20px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '0.78rem', color: 'var(--accent-primary)' }}>
                {k.name} ({(k.similarity * 100).toFixed(0)}% similar)
              </span>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{result.note}</div>
        </div>
      )}
    </div>
  );
}

// ─── Main Institutes Page ─────────────────────────────────────────────────
function Institutes() {
  const [activeTab, setActiveTab] = useState('momentum');

  const tabs = [
    { id: 'momentum', label: '📈 Institute Momentum Index' },
    { id: 'velocity', label: '⚡ Batch Peer Velocity' },
    { id: 'coldstart', label: '🔬 Cold-Start Scoring' },
  ];

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1>Institute Intelligence</h1>
        <p>Momentum tracking, cohort velocity alerts, and cold-start scoring for new institutes.</p>
      </div>
      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>
      {activeTab === 'momentum' && <div className="card"><div className="card-title"><Building2 size={14} /> Institute Momentum Index (§10.12)</div><MomentumPanel /></div>}
      {activeTab === 'velocity' && <div className="card"><div className="card-title"><Users size={14} /> Batch Peer Velocity Tracker (§10.9)</div><VelocityPanel /></div>}
      {activeTab === 'coldstart' && <div className="card"><div className="card-title"><Zap size={14} /> Cold-Start Institute Scoring (§10.7) ⭐</div><ColdStartPanel /></div>}
    </div>
  );
}

export default Institutes;
