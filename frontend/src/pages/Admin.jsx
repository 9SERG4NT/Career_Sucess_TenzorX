import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Shield, Zap, ChevronDown, ChevronUp, Save, RefreshCw, CheckCircle, Users } from 'lucide-react';
import { API_BASE } from '../App';

function ConfigSection({ title, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon size={14} /> {title}
        </div>
        {open ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
      </div>
      {open && <div style={{ marginTop: '1rem' }}>{children}</div>}
    </div>
  );
}

function SliderField({ label, value, min, max, step = 0.01, onChange, suffix = '' }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'monospace' }}>
          {value}{suffix}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
      />
    </div>
  );
}

function Admin() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ccData, setCcData] = useState(null);
  const [fairness, setFairness] = useState(null);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/admin/config`).then(r => setConfig(r.data)).catch(() => {});
    axios.get(`${API_BASE}/api/v1/model/champion-challenger`).then(r => setCcData(r.data)).catch(() => {});
    axios.get(`${API_BASE}/api/v1/model/fairness`).then(r => setFairness(r.data)).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await axios.put(`${API_BASE}/api/v1/admin/config`, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
    setSaving(false);
  };

  const updateNested = (section, key, val) => {
    setConfig(c => ({ ...c, [section]: { ...c[section], [key]: val } }));
  };

  if (!config) return (
    <div style={{ padding: '3rem', color: 'var(--text-secondary)' }}>
      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '0.5rem' }} />
      Loading admin config...
    </div>
  );

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Admin Configuration Panel (F-12)</h1>
          <p>Manage risk thresholds, model config, NBA costs, and tenant settings. Requires Admin role with MFA.</p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saved ? <CheckCircle size={14} /> : saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Config'}
        </button>
      </div>

      {/* Tenant info */}
      <div className="card" style={{ marginBottom: '1rem', borderTop: '2px solid var(--accent-primary)' }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Lender', val: config.tenant?.lender_name },
            { label: 'Lender ID', val: config.tenant?.lender_id },
            { label: 'Max Students', val: config.tenant?.max_students?.toLocaleString() },
            { label: 'MFA Required', val: config.tenant?.mfa_required ? '✅ Yes' : '❌ No' },
            { label: 'Last Modified', val: config.last_modified?.slice(0, 10) },
            { label: 'Modified By', val: config.modified_by },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>{label}</div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Thresholds */}
      <ConfigSection title="Risk Band Thresholds" icon={Shield} defaultOpen>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Adjust the 6-month placement probability cutoffs that determine HIGH / MEDIUM / LOW risk classification.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div>
            <SliderField
              label="HIGH Risk — max probability"
              value={config.risk_thresholds?.high_max}
              min={0.20} max={0.60} step={0.01}
              suffix=" (≤ this = HIGH)"
              onChange={v => updateNested('risk_thresholds', 'high_max', v)}
            />
            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.08)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--risk-high)' }}>
              🔴 P(6m) ≤ {config.risk_thresholds?.high_max} → HIGH Risk
            </div>
          </div>
          <div>
            <SliderField
              label="MEDIUM Risk — max probability"
              value={config.risk_thresholds?.medium_max}
              min={0.50} max={0.90} step={0.01}
              suffix=" (≤ this = MEDIUM)"
              onChange={v => updateNested('risk_thresholds', 'medium_max', v)}
            />
            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(245,158,11,0.08)', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--risk-medium)' }}>
              🟡 {config.risk_thresholds?.high_max} &lt; P(6m) ≤ {config.risk_thresholds?.medium_max} → MEDIUM
            </div>
          </div>
        </div>
      </ConfigSection>

      {/* EMI Comfort Tiers */}
      <ConfigSection title="EMI Comfort Tier Thresholds" icon={Zap}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {Object.entries(config.emi_comfort_tiers || {}).map(([tier, val]) => (
            <div key={tier}>
              <SliderField
                label={tier.charAt(0).toUpperCase() + tier.slice(1)}
                value={val} min={0.5} max={5} step={0.1}
                suffix="x EMI ratio"
                onChange={v => updateNested('emi_comfort_tiers', tier, v)}
              />
            </div>
          ))}
        </div>
      </ConfigSection>

      {/* Alert Engine */}
      <ConfigSection title="Early Alert Engine Thresholds" icon={Settings}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <SliderField
            label="Critical CGPA threshold"
            value={config.alert_engine?.critical_cgpa_threshold}
            min={4.0} max={8.0} step={0.1}
            onChange={v => updateNested('alert_engine', 'critical_cgpa_threshold', v)}
          />
          <SliderField
            label="Medium CGPA threshold"
            value={config.alert_engine?.medium_cgpa_threshold}
            min={5.0} max={9.0} step={0.1}
            onChange={v => updateNested('alert_engine', 'medium_cgpa_threshold', v)}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Max alerts per run:</span>
          <input
            type="number" min={10} max={1000} value={config.alert_engine?.max_alerts_per_run}
            onChange={e => updateNested('alert_engine', 'max_alerts_per_run', parseInt(e.target.value))}
            className="select-input" style={{ width: '100px' }}
          />
        </div>
      </ConfigSection>

      {/* Intervention Costs */}
      <ConfigSection title="NBA Intervention Cost Table" icon={Users}>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Costs (₹ INR) used by the Intervention Simulator ROI calculator.</p>
        <table className="data-table">
          <thead><tr><th>Intervention</th><th>Cost (₹)</th></tr></thead>
          <tbody>
            {Object.entries(config.intervention_costs || {}).map(([action, cost]) => (
              <tr key={action}>
                <td>{action}</td>
                <td>
                  <input
                    type="number" min={0} value={cost}
                    onChange={e => setConfig(c => ({ ...c, intervention_costs: { ...c.intervention_costs, [action]: parseInt(e.target.value) || 0 } }))}
                    className="select-input" style={{ width: '100px' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ConfigSection>

      {/* Model Config */}
      <ConfigSection title="Model Configuration & Champion/Challenger" icon={Zap}>
        {ccData && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(16,185,129,0.06)', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--risk-low)', fontWeight: 700, marginBottom: '0.5rem' }}>👑 CHAMPION MODEL</div>
              {Object.entries(ccData.champion).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{String(v)}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '1rem', background: 'rgba(100,116,139,0.05)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.5rem' }}>🥊 CHALLENGER MODEL</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{ccData.challenger?.status}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{ccData.challenger?.note}</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Auto-retrain PSI threshold:</span>
          <SliderField
            label="" value={config.model_config?.retrain_psi_threshold}
            min={0.05} max={0.50} step={0.01}
            onChange={v => updateNested('model_config', 'retrain_psi_threshold', v)}
          />
        </div>
      </ConfigSection>

      {/* Fairness Report */}
      {fairness && (
        <div className="card">
          <div className="card-title"><Shield size={14} /> Model Fairness Audit (§16.2)</div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
            <span className={`badge ${fairness.overall_status === 'PASS' ? 'badge-low' : 'badge-high'}`}>
              {fairness.overall_status === 'PASS' ? '✓ Overall PASS' : '⚠ Overall FAIL'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Audit date: {fairness.audit_date} | Next: {fairness.next_audit}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {Object.entries(fairness.dimensions || {}).map(([dim, info]) => (
              <div key={dim} style={{ padding: '0.75rem', borderRadius: '8px', background: info.status === 'PASS' ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${info.status === 'PASS' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: info.status === 'PASS' ? 'var(--risk-low)' : 'var(--risk-high)', marginBottom: '0.35rem' }}>
                  {info.status === 'PASS' ? '✓' : '✗'} {dim}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Max disparity: <strong>{(info.max_disparity * 100).toFixed(1)}%</strong></div>
                {info.alert && <div style={{ fontSize: '0.72rem', color: 'var(--risk-high)', marginTop: '0.25rem' }}>⚠ Exceeds 10% threshold. SLA: 30 days.</div>}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Protected attributes excluded: {fairness.protected_attributes_excluded?.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}

export default Admin;
