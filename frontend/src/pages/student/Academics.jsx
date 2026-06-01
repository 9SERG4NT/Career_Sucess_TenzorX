import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  GraduationCap, Save, RefreshCw, AlertTriangle, CheckCircle2, Info,
  TrendingUp, TrendingDown, Minus, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../App';

// Fields the borrower maintains. These map 1:1 to the backend PUT
// /api/v1/student/{id} editable attributes; saving re-scores immediately.
const EMPLOYER_TIERS = ['MNC', 'Unicorn', 'MidSize', 'Startup', 'Local'];
const INSTITUTE_TIERS = ['A', 'B', 'C', 'D'];

const bandColor = (b) => b === 'LOW' ? 'var(--risk-low)' : b === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';

function Slider({ label, value, min, max, step, onChange, hint }) {
  return (
    <label className="apply-field" style={{ display: 'block', marginBottom: '1.1rem' }}>
      <span className="apply-field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span>
        <span className="mono" style={{ color: 'var(--signal)', fontWeight: 700 }}>{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))} className="apply-slider" style={{ width: '100%' }} />
      {hint && <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>{hint}</span>}
    </label>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange, hint }) {
  return (
    <label className="apply-field" style={{ display: 'block', marginBottom: '1.1rem' }}>
      <span className="apply-field-label">{label}</span>
      <input className="select-input" type="number" min={min} max={max} step={step}
        value={value} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        style={{ width: '100%' }} />
      {hint && <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>{hint}</span>}
    </label>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="apply-field" style={{ display: 'block', marginBottom: '1.1rem' }}>
      <span className="apply-field-label">{label}</span>
      <select className="select-input" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default function Academics() {
  const { user } = useAuth();
  const sid = user?.studentId;

  const [profile, setProfile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState(null);
  const [prevBand, setPrevBand] = useState(null);
  const [prev6m, setPrev6m] = useState(null);

  const seedForm = (p) => ({
    cgpa: Number(p.cgpa ?? 7),
    internship_months: Number(p.internship_months ?? 0),
    active_backlogs: Number(p.active_backlogs ?? 0),
    behavioral_activity_score: Number(p.behavioral_activity_score ?? 50),
    iqi: Number(p.iqi ?? 0.3),
    monthly_emi: Number(p.monthly_emi ?? 12000),
    employer_tier: p.employer_tier || 'Startup',
    institute_tier: p.institute_tier || 'B',
  });

  const load = useCallback(async () => {
    if (!sid) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/api/v1/student/${sid}`);
      setProfile(r.data.profile);
      setAnalysis(r.data.analysis);
      setForm(seedForm(r.data.profile));
      setError(null);
    } catch (e) {
      setError(e?.response?.status === 404
        ? `No borrower record found for ${sid}. Ask your lender to onboard you.`
        : 'Cannot reach the backend on port 8001.');
    } finally {
      setLoading(false);
    }
  }, [sid]);

  useEffect(() => { load(); }, [load]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setSaving(true);
    setError(null);
    setFlash(null);
    // Remember the band/prob before the edit so we can show the delta.
    setPrevBand(analysis?.prediction?.risk_band);
    setPrev6m(analysis?.prediction?.placement_probability?.['6m']);
    try {
      const r = await axios.put(`${API_BASE}/api/v1/student/${sid}`, form);
      setProfile(r.data.profile);
      setAnalysis(r.data.analysis);
      setForm(seedForm(r.data.profile));
      const fields = (r.data.updated_fields || []).join(', ');
      setFlash(`Saved & re-scored${fields ? ` — updated: ${fields}` : ''}.`);
      setTimeout(() => setFlash(null), 5000);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '4rem 2rem', color: 'var(--ink-muted)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--signal)' }} />
      <span style={{ fontSize: '0.9rem' }}>Loading your record…</span>
    </div>
  );

  if (error && !profile) return (
    <div style={{ padding: '2rem' }}>
      <div className="alert-banner alert-high">
        <AlertTriangle size={20} color="var(--risk-high)" />
        <div><strong>Couldn't load your academics</strong>
          <p style={{ marginTop: '0.25rem', color: 'var(--ink-muted)', fontSize: '0.875rem' }}>{error}</p></div>
      </div>
    </div>
  );

  const pred = analysis?.prediction || {};
  const band = pred.risk_band || 'MEDIUM';
  const prob6 = Math.round((pred.placement_probability?.['6m'] || 0) * 100);
  const drivers = analysis?.explainability?.top_drivers || [];
  const emiComfort = analysis?.insights?.emi_comfort_index;

  // Direction of the last change.
  let delta = null;
  if (prev6m != null && pred.placement_probability?.['6m'] != null) {
    delta = Math.round((pred.placement_probability['6m'] - prev6m) * 100);
  }

  return (
    <div className="animate-fade-up">
      <div className="page-header">
        <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>My Academics</div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <GraduationCap size={26} color="var(--signal)" /> Keep your record current.
        </h1>
        <p style={{ marginTop: '0.55rem', maxWidth: '64ch' }}>
          Update your CGPA, internships, and any active backlog each semester. The moment you save,
          your placement-risk score is recomputed — and your lender sees the same updated number.
          <span className="mono" style={{ marginLeft: '0.5em', color: 'var(--ink-faint)' }}>{sid}</span>
        </p>
      </div>

      {/* Live score banner */}
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${bandColor(band)}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
            <div>
              <div className="card-title" style={{ marginBottom: '0.35rem' }}><ShieldAlert size={13} /> Risk band</div>
              <span className={`badge badge-${band.toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '0.3rem 0.8rem' }}>{band}</span>
              {prevBand && prevBand !== band && (
                <span style={{ marginLeft: '0.6rem', fontSize: '0.74rem', color: 'var(--ink-faint)' }}>was {prevBand}</span>
              )}
            </div>
            <div>
              <div className="card-title" style={{ marginBottom: '0.35rem' }}>6-month placement</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span className="stat-value" style={{ color: bandColor(band) }}>{prob6}%</span>
                {delta != null && delta !== 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', fontWeight: 700,
                    color: delta > 0 ? 'var(--risk-low)' : 'var(--risk-high)' }}>
                    {delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{delta > 0 ? '+' : ''}{delta}pp
                  </span>
                )}
                {delta === 0 && <Minus size={13} color="var(--ink-faint)" />}
              </div>
            </div>
            {emiComfort != null && (
              <div>
                <div className="card-title" style={{ marginBottom: '0.35rem' }}>EMI comfort</div>
                <span className="stat-value" style={{ fontSize: '1.6rem' }}>{emiComfort === 99 ? '∞' : `${emiComfort}×`}</span>
              </div>
            )}
          </div>
        </div>
        {drivers.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--rule)' }}>
            <div className="card-title" style={{ marginBottom: '0.5rem' }}>What's moving your score</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {drivers.map((d, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.82rem' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '6px', flexShrink: 0,
                    background: d.impact_direction === 'Positive' ? 'var(--risk-low)' : 'var(--risk-high)' }} />
                  <span style={{ color: 'var(--ink-soft)' }}>{d.description || d.readable_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {flash && (
        <div className="alert-banner" style={{ marginBottom: '1.25rem', borderLeftColor: 'var(--risk-low)', background: 'var(--risk-low-bg)' }}>
          <CheckCircle2 size={18} color="var(--risk-low)" />
          <div style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{flash}</div>
        </div>
      )}
      {error && profile && (
        <div className="alert-banner alert-high" style={{ marginBottom: '1.25rem' }}>
          <AlertTriangle size={18} color="var(--risk-high)" />
          <div style={{ fontSize: '0.85rem' }}>{error}</div>
        </div>
      )}

      {/* Editor */}
      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-title"><GraduationCap size={13} /> Academic profile</div>
          <div style={{ marginTop: '0.75rem' }}>
            <Slider label="CGPA" value={form.cgpa} min={0} max={10} step={0.1}
              onChange={(v) => set({ cgpa: v })} hint="Your latest cumulative GPA out of 10." />
            <Slider label="Internship months" value={form.internship_months} min={0} max={24} step={1}
              onChange={(v) => set({ internship_months: v })} hint="Total months of internship experience." />
            <NumberField label="Active backlogs (this semester)" value={form.active_backlogs} min={0} max={20}
              onChange={(v) => set({ active_backlogs: v })}
              hint="Unresolved papers. ≥2 forces a HIGH-risk flag — clear them to recover your score." />
            <SelectField label="Institute tier" value={form.institute_tier} options={INSTITUTE_TIERS}
              onChange={(v) => set({ institute_tier: v })} />
          </div>
        </div>

        <div className="card">
          <div className="card-title"><TrendingUp size={13} /> Activity & financial</div>
          <div style={{ marginTop: '0.75rem' }}>
            <Slider label="Job-portal activity (0–100)" value={form.behavioral_activity_score} min={0} max={100} step={1}
              onChange={(v) => set({ behavioral_activity_score: v })} hint="How actively you apply / engage on job portals." />
            <Slider label="Internship quality index (0–1)" value={form.iqi} min={0} max={1} step={0.01}
              onChange={(v) => set({ iqi: v })} hint="Quality/relevance of your internship experience." />
            <NumberField label="Monthly EMI (₹)" value={form.monthly_emi} min={0} max={200000} step={500}
              onChange={(v) => set({ monthly_emi: v })} hint="Your education-loan EMI; drives the EMI-comfort check." />
            <SelectField label="Target employer tier" value={form.employer_tier} options={EMPLOYER_TIERS}
              onChange={(v) => set({ employer_tier: v })} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
          {saving ? 'Saving & re-scoring…' : 'Save & re-score'}
        </button>
        <button className="btn btn-ghost" onClick={load} disabled={saving}>
          <RefreshCw size={13} /> Discard changes
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'var(--ink-faint)' }}>
          <Info size={12} /> Your lender's dashboard updates the instant you save.
        </span>
      </div>
    </div>
  );
}
