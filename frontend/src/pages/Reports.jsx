import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BookOpen, Download, Shield, Activity, RefreshCw, FileText, AlertTriangle } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { API_BASE } from '../App';

// ─── Model Drift Panel ──────────────────────────────────────────────────────
function DriftPanel() {
  const [drift, setDrift] = useState(null);
  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/model/drift`).then(r => setDrift(r.data)).catch(() => {});
  }, []);
  if (!drift) return <div style={{ color: 'var(--text-muted)', padding: '1rem' }}>Loading drift data...</div>;

  const statusColor = drift.drift_status === 'STABLE' ? 'var(--risk-low)' : drift.drift_status === 'MINOR_DRIFT' ? 'var(--risk-medium)' : 'var(--risk-high)';

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Overall PSI', val: drift.overall_psi, color: statusColor },
          { label: 'Drift Status', val: drift.drift_status.replace('_', ' '), color: statusColor },
          { label: 'Window', val: drift.monitoring_window, color: 'var(--text-primary)' },
          { label: 'Alert', val: drift.alert_triggered ? '⚠️ YES' : '✓ None', color: drift.alert_triggered ? 'var(--risk-medium)' : 'var(--risk-low)' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ flex: 1, minWidth: '120px', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.82rem', color: drift.alert_triggered ? 'var(--risk-medium)' : 'var(--text-secondary)', padding: '0.5rem 0.75rem', background: drift.alert_triggered ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.02)', borderRadius: '6px', border: `1px solid ${drift.alert_triggered ? 'rgba(245,158,11,0.2)' : 'var(--border-color)'}`, marginBottom: '1.25rem' }}>
        {drift.alert_triggered ? '⚠️ ' : '✓ '}{drift.alert_message}
      </div>
      <div className="card-title" style={{ marginBottom: '0.75rem' }}>Feature-Level PSI</div>
      {drift.feature_level_drift?.map((f, i) => {
        const psiColor = f.status === 'STABLE' ? 'var(--risk-low)' : f.status === 'MINOR_DRIFT' ? 'var(--risk-medium)' : 'var(--risk-high)';
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.6rem' }}>
            <div style={{ width: '180px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{f.feature}</div>
            <div className="progress-bar-track" style={{ flex: 1 }}>
              <div className="progress-bar-fill" style={{ width: `${Math.min(100, f.psi * 400)}%`, background: psiColor }} />
            </div>
            <div style={{ width: '50px', textAlign: 'right', fontWeight: 600, fontSize: '0.8rem', color: psiColor }}>{f.psi}</div>
            <span className={`badge badge-${f.status === 'STABLE' ? 'low' : 'medium'}`} style={{ fontSize: '0.7rem', width: '110px', textAlign: 'center' }}>{f.status}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Score History Mini-Search ──────────────────────────────────────────────
function ScoreHistory() {
  const [studentId, setStudentId] = useState('');
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async () => {
    if (!studentId.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/student/${studentId.trim()}/history`);
      setHistory(res.data);
    } catch {
      setHistory({ error: 'Student not found' });
    } finally {
      setLoading(false);
    }
  };

  const chartData = history?.snapshots?.map(s => ({
    date: s.date.slice(5),  // MM-DD
    prob: Math.round(s.placement_probability_6m * 100),
    band: s.risk_band,
  }));

  const trendColor = history?.trend === 'IMPROVING' ? 'var(--risk-low)' : 'var(--risk-high)';

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <input
          type="text"
          placeholder="e.g. STU-2026-00001"
          value={studentId}
          onChange={e => setStudentId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchHistory()}
          className="select-input"
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary" onClick={fetchHistory} disabled={loading}>
          {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={14} />}
          {loading ? 'Loading...' : 'Load History'}
        </button>
      </div>

      {history?.error && <div style={{ color: 'var(--risk-high)', fontSize: '0.875rem' }}>⚠️ {history.error}</div>}

      {history && !history.error && (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span className={`badge ${history.trend === 'IMPROVING' ? 'badge-low' : 'badge-high'}`}>
              {history.trend === 'IMPROVING' ? '↑ Improving' : '↓ Declining'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {history.first_scored} → {history.last_scored} ({history.history_window_days} days)
            </span>
          </div>
          <div style={{ height: '180px', minHeight: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.82rem' }}
                  formatter={v => [`${v}%`, '6M Probability']}
                  labelStyle={{ color: 'var(--text-secondary)' }}
                />
                <ReferenceLine y={70} stroke="var(--risk-low)" strokeDasharray="4 4" label={{ value: 'LOW', fill: 'var(--risk-low)', fontSize: 10 }} />
                <ReferenceLine y={45} stroke="var(--risk-medium)" strokeDasharray="4 4" label={{ value: 'MED', fill: 'var(--risk-medium)', fontSize: 10 }} />
                <Line type="monotone" dataKey="prob" stroke={trendColor} strokeWidth={2} dot={{ fill: trendColor, r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bulk Scoring Panel ─────────────────────────────────────────────────────
function BulkScoring() {
  const [inputIds, setInputIds] = useState('STU-2026-00001\nSTU-2026-00002\nSTU-2026-00003');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const runBatch = async () => {
    const ids = inputIds.split('\n').map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setRunning(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/score/batch`, { student_ids: ids, lender_id: 'LND-DEMO-001' });
      setResult(res.data);
    } catch {
      setResult({ error: 'Batch scoring failed.' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Enter student IDs (one per line). Batch-scores up to 1,000 students in a single request.
      </p>
      <textarea
        value={inputIds}
        onChange={e => setInputIds(e.target.value)}
        rows={5}
        className="select-input"
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem', resize: 'vertical', marginBottom: '0.75rem' }}
        placeholder="STU-2026-00001&#10;STU-2026-00002&#10;..."
      />
      <button className="btn btn-primary" onClick={runBatch} disabled={running} style={{ marginBottom: '1.25rem' }}>
        {running ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={14} />}
        {running ? 'Scoring batch...' : 'Run Batch Score'}
      </button>

      {result?.error && <div style={{ color: 'var(--risk-high)', fontSize: '0.875rem' }}>⚠️ {result.error}</div>}

      {result && !result.error && (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span className="badge badge-info">Job: {result.job_id}</span>
            <span className="badge badge-low">✓ Scored: {result.scored}</span>
            {result.errors > 0 && <span className="badge badge-high">✗ Errors: {result.errors}</span>}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student ID</th>
                  <th>Risk Band</th>
                  <th>6M Prob</th>
                  <th>Expected Salary</th>
                  <th>EMI Comfort</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.student_id}</td>
                    <td><span className={`badge badge-${r.risk_band.toLowerCase()}`}>{r.risk_band}</span></td>
                    <td style={{ fontWeight: 600 }}>{Math.round(r.placement_probability_6m * 100)}%</td>
                    <td>₹{r.expected_salary?.toLocaleString()}</td>
                    <td>{r.emi_comfort_index === 99 ? '∞' : `${r.emi_comfort_index}x`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Reports Page ──────────────────────────────────────────────────────
function Reports() {
  const [activeTab, setActiveTab] = useState('drift');

  const tabs = [
    { id: 'drift', label: '📊 Model Drift Monitor (F-10)' },
    { id: 'history', label: '📈 90-Day Score History (F-11)' },
    { id: 'bulk', label: '⚡ Bulk Scoring (F-09)' },
  ];

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <h1>Reports & Analytics</h1>
        <p>Model health monitoring, audit trails, and batch processing tools.</p>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'drift' && (
        <div className="card">
          <div className="card-title"><Shield size={14} /> Model Drift Monitoring — PSI Analysis</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Population Stability Index (PSI) measures score distribution drift between training baseline and current population. PSI &lt;0.10 = stable; 0.10–0.25 = minor drift; &gt;0.25 = major drift requiring retraining.
          </p>
          <DriftPanel />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="card-title"><Activity size={14} /> 90-Day Score History & Trend</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            View a student's full placement probability trajectory over the last 90 days with weekly scoring snapshots, risk band transitions, and trend direction.
          </p>
          <ScoreHistory />
        </div>
      )}

      {activeTab === 'bulk' && (
        <div className="card">
          <div className="card-title"><FileText size={14} /> Bulk Portfolio Scoring (F-09)</div>
          <BulkScoring />
        </div>
      )}
    </div>
  );
}

export default Reports;
