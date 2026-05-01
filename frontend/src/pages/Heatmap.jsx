import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw, Filter } from 'lucide-react';
import { API_BASE } from '../App';

const FIELD_COLORS = {
  Engineering: 'var(--accent-primary)',
  MBA: '#a855f7',
  Nursing: '#ec4899',
};

const DEMAND_COLOR = (score) => {
  if (score >= 80) return { bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.4)', text: '#10B981' };
  if (score >= 65) return { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#F59E0B' };
  return { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)', text: '#EF4444' };
};

function TrendBadge({ trend }) {
  const isUp = trend?.startsWith('+');
  const isDown = trend?.startsWith('-');
  return (
    <span style={{
      fontSize: '0.7rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
      background: isUp ? 'rgba(16,185,129,0.15)' : isDown ? 'rgba(239,68,68,0.12)' : 'rgba(100,116,139,0.15)',
      color: isUp ? '#10B981' : isDown ? '#EF4444' : '#94a3b8',
      display: 'inline-flex', alignItems: 'center', gap: '2px'
    }}>
      {isUp ? <TrendingUp size={9} /> : isDown ? <TrendingDown size={9} /> : <Minus size={9} />}
      {trend}
    </span>
  );
}

function HeatCell({ cell, onClick, selected }) {
  const colors = DEMAND_COLOR(cell.demand_score);
  return (
    <div
      onClick={() => onClick(cell)}
      style={{
        background: selected ? colors.bg : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? colors.border : 'var(--border-color)'}`,
        borderRadius: '10px',
        padding: '0.85rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = colors.bg; e.currentTarget.style.borderColor = colors.border; }}
      onMouseLeave={e => {
        if (!selected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          e.currentTarget.style.borderColor = 'var(--border-color)';
        }
      }}
    >
      {/* Score bar in background */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', width: `${cell.demand_score}%`, background: colors.text, opacity: 0.6, borderRadius: '0 0 0 10px' }} />

      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>{cell.region}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: colors.text, lineHeight: 1 }}>{cell.demand_score}</div>
      <div style={{ marginTop: '0.3rem' }}>
        <TrendBadge trend={cell.trend} />
      </div>
    </div>
  );
}

function Heatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterField, setFilterField] = useState('ALL');
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const params = {};
      if (filterField !== 'ALL') params.field = filterField;
      if (filterRegion !== 'ALL') params.region = filterRegion;
      const res = await axios.get(`${API_BASE}/api/v1/heatmap/demand`, { params });
      setData(res.data);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterField, filterRegion]);

  const fields = ['ALL', 'Engineering', 'MBA', 'Nursing'];
  const regions = ['ALL', 'Mumbai', 'Bengaluru', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai'];

  if (loading) return (
    <div style={{ padding: '3rem', display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--text-secondary)' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      Loading heatmap...
    </div>
  );

  const grid = data?.grid || [];
  const fieldGroups = [...new Set(grid.map(c => c.field))];

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Dynamic Employability Heatmap ⭐</h1>
          <p>Real-time field × region demand scores. Green = high hiring activity. Updated: {data?.last_updated}</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData} disabled={refreshing}>
          <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Filter size={13} style={{ color: 'var(--text-secondary)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Field:</span>
            {fields.map(f => (
              <button key={f} onClick={() => setFilterField(f)}
                className={`badge ${filterField === f ? 'badge-info' : ''}`}
                style={{ cursor: 'pointer', opacity: filterField === f ? 1 : 0.5, border: filterField === f ? '1px solid var(--accent-primary)' : '1px solid transparent' }}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Region:</span>
            <select className="select-input" value={filterRegion} onChange={e => setFilterRegion(e.target.value)} style={{ fontSize: '0.82rem' }}>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>🟢 ≥80 High Demand</span>
            <span>🟡 65–79 Medium</span>
            <span>🔴 &lt;65 Low Demand</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid per field */}
      {fieldGroups.map(field => {
        const cells = grid.filter(c => c.field === field);
        const avgDemand = Math.round(cells.reduce((s, c) => s + c.demand_score, 0) / (cells.length || 1));
        return (
          <div key={field} className="card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: FIELD_COLORS[field] || 'var(--accent-primary)' }} />
              <div className="card-title" style={{ margin: 0 }}><BarChart3 size={14} /> {field}</div>
              <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Avg demand: {avgDemand}/100</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cells.length, 6)}, 1fr)`, gap: '0.75rem' }}>
              {cells.map((cell, i) => (
                <HeatCell key={i} cell={cell} selected={selected?.field === cell.field && selected?.region === cell.region} onClick={setSelected} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Detail panel */}
      {selected && (
        <div className="card" style={{ borderTop: `2px solid ${DEMAND_COLOR(selected.demand_score).text}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div className="card-title"><TrendingUp size={14} /> {selected.field} · {selected.region}</div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: DEMAND_COLOR(selected.demand_score).text }}>{selected.demand_score}/100</span>
                <TrendBadge trend={selected.trend} />
                <span className={`badge badge-${selected.risk_level === 'HIGH' ? 'low' : selected.risk_level === 'MEDIUM' ? 'medium' : 'high'}`}>
                  {selected.risk_level === 'HIGH' ? 'High Demand' : selected.risk_level === 'MEDIUM' ? 'Medium Demand' : 'Low Demand'}
                </span>
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>✕ Close</button>
          </div>
          <div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontWeight: 600 }}>Top Hiring Roles:</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selected.top_roles?.map((role, i) => (
                <span key={i} style={{
                  padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 500,
                  background: DEMAND_COLOR(selected.demand_score).bg,
                  border: `1px solid ${DEMAND_COLOR(selected.demand_score).border}`,
                  color: DEMAND_COLOR(selected.demand_score).text
                }}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Heatmap;
