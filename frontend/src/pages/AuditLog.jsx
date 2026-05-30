import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  ShieldCheck, Database, Archive, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, XCircle,
} from 'lucide-react';
import { API_BASE } from '../App';

const DECISION_COLOR = {
  APPROVE:     'var(--risk-low)',
  CONDITIONAL: 'var(--risk-medium)',
  DENY:        'var(--risk-high)',
};
const DECISION_ICON = {
  APPROVE: CheckCircle2,
  CONDITIONAL: AlertCircle,
  DENY: XCircle,
};

function DecisionRow({ d, expanded, onToggle }) {
  const color = DECISION_COLOR[d.decision] || 'var(--ink)';
  const Icon = DECISION_ICON[d.decision] || AlertCircle;
  const audit = d.audit || {};
  const snap = audit.feature_snapshot || {};
  const shap = audit.top_shap_drivers || [];

  return (
    <div className="card audit-row" style={{ marginBottom: '0.65rem', padding: 0, overflow: 'hidden' }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem',
          cursor: 'pointer', borderLeft: `3px solid ${color}`,
        }}
      >
        <Icon size={18} color={color} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{audit.decision_id || '—'}</span>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color }}>{d.decision}</span>
            <span className={`badge badge-${(d.adjusted_risk_band || 'medium').toLowerCase()}`} style={{ fontSize: '0.7rem' }}>{d.adjusted_risk_band}</span>
            {d.cold_start && <span className="badge badge-medium" style={{ fontSize: '0.7rem' }}>COLD-START</span>}
            <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint)' }}>
              p(6m): {Math.round((d.adjusted_placement_6m || 0) * 100)}%
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint)' }}>
              EMI: {d.emi_comfort_index?.toFixed(1)}×
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint)' }}>
              boost: +{d.profile_boost_applied_pp || 0}pp
            </span>
          </div>
          <div style={{ marginTop: '0.2rem', fontSize: '0.72rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>
            {audit.decided_at_utc?.replace('T', ' ').slice(0, 19)} · model {audit.model_version}
          </div>
        </div>
        {expanded ? <ChevronUp size={15} color="var(--ink-faint)" /> : <ChevronDown size={15} color="var(--ink-faint)" />}
      </div>

      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={{ borderTop: '1px solid var(--rule)', padding: '1rem' }}
        >
          <div className="grid-2" style={{ gap: '1.25rem' }}>
            <div>
              <div className="card-title" style={{ marginBottom: '0.55rem' }}>Feature snapshot</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {Object.entries(snap).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="card-title" style={{ marginBottom: '0.55rem' }}>Top SHAP drivers</div>
              {shap.length === 0 && <div style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>—</div>}
              {shap.map((s, i) => (
                <div key={i} style={{ marginBottom: '0.45rem', fontSize: '0.78rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{s.feature}</span>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      color: s.impact === 'Positive' ? 'var(--risk-low)' : 'var(--risk-high)',
                    }}>
                      {s.impact === 'Positive' ? '+' : ''}{s.shap_value}
                    </span>
                  </div>
                </div>
              ))}
              <div className="card-title" style={{ marginTop: '1rem', marginBottom: '0.4rem' }}>Decision reasons</div>
              {d.decision_reasons?.slice(0, 3).map((r, i) => (
                <div key={i} style={{ fontSize: '0.76rem', color: 'var(--ink-soft)', marginBottom: '0.3rem' }}>· {r}</div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '0.85rem', padding: '0.55rem 0.75rem', background: 'var(--card-raised)', borderRadius: '4px', fontSize: '0.72rem', color: 'var(--ink-muted)', fontFamily: 'var(--font-mono)' }}>
            <ShieldCheck size={10} style={{ verticalAlign: '-1px', marginRight: '5px' }} />
            Retained until: <strong>{audit.retained_until_utc?.slice(0, 10)}</strong> · {audit.compliance_basis}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function AuditLog() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(new Set());

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/api/v1/audit/decisions?limit=50`);
      setData(r.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAudit(); }, []);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>
        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading audit log…
      </div>
    );
  }

  const decisions = data?.decisions || [];

  return (
    <div className="animate-fade-up">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>Audit</span>
          </div>
          <h1>Decision Audit Log</h1>
          <p style={{ marginTop: '0.55rem', maxWidth: '60ch' }}>
            Every loan decision logged with full feature snapshot, model version, SHAP attributions, and retention timestamp —
            satisfying RBI IT Framework and DPDP Section 11 (right to explanation) requirements.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchAudit}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Compliance ribbon */}
      <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <Stat label="Logged decisions" value={data?.total_decisions_logged?.toLocaleString() || 0} />
          <Stat label="Retention" value="7 years" />
          <Stat label="Storage" value="OpenSearch + Glacier" />
          <Stat label="Compliance basis" value="RBI · DPDP 11" />
        </div>
        <span className="badge badge-low" style={{ fontSize: '0.74rem' }}>
          <Archive size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }} />
          Immutable
        </span>
      </div>

      {/* Empty state */}
      {decisions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Database size={32} style={{ color: 'var(--ink-faint)', marginBottom: '0.85rem' }} />
          <h3 style={{ marginBottom: '0.4rem' }}>No decisions logged yet</h3>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem' }}>
            Trigger a loan decision (from the student-side decision page) to populate the audit log.
          </p>
        </div>
      )}

      {/* Decision rows */}
      {decisions.map((d) => (
        <DecisionRow
          key={d.audit?.decision_id || JSON.stringify(d.decision_reasons)}
          d={d}
          expanded={expanded.has(d.audit?.decision_id)}
          onToggle={() => toggle(d.audit?.decision_id)}
        />
      ))}

      {/* Storage note */}
      {decisions.length > 0 && (
        <div style={{ marginTop: '1.25rem', fontSize: '0.74rem', color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center' }}>
          {data?.storage_note}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>
        {label}
      </div>
      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--ink)' }}>{value}</div>
    </div>
  );
}
