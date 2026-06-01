import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  User, GraduationCap, Briefcase, Target, Save, Plus, X, RefreshCw,
  CheckCircle2, AlertTriangle, ShieldAlert, TrendingUp, TrendingDown,
  Info, Award, Code2, MessageSquare, Wrench, Minus, ShieldCheck, Lock,
  Clock, XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../App';

// ─── constants ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'personal',      label: 'Personal',      icon: User        },
  { id: 'academic',      label: 'Academic',       icon: GraduationCap },
  { id: 'employability', label: 'Employability',  icon: Briefcase   },
  { id: 'placement',     label: 'Placement',      icon: Target      },
  { id: 'verification',  label: 'Verification',   icon: ShieldCheck },
];
const INTERNSHIP_TIERS    = ['MNC', 'Unicorn', 'MidSize', 'Startup', 'Other'];
const INTERVIEW_STATUSES  = ['', 'Applied', 'Shortlisted', 'Interview Scheduled', 'Selected', 'Offer Received', 'Rejected'];
const INDIA_STATES        = ['Andhra Pradesh','Assam','Bihar','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];
const bandColor = b => b === 'LOW' ? 'var(--risk-low)' : b === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';

// ─── tiny shared widgets ─────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: '1rem' }}>
      <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginBottom: '0.4rem' }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.68rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>{hint}</span>}
    </label>
  );
}
const inp = { className: 'select-input', style: { width: '100%' } };

function Slider({ label, value, min, max, step, onChange, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input type="range" min={min} max={max} step={step} value={value ?? min}
          onChange={e => onChange(parseFloat(e.target.value))} className="apply-slider" style={{ flex: 1 }} />
        <span className="mono" style={{ color: 'var(--signal)', fontWeight: 700, minWidth: '3.5ch' }}>{value ?? min}</span>
      </div>
    </Field>
  );
}

function TagInput({ label, tags, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); }
    setInput('');
  };
  const remove = t => onChange(tags.filter(x => x !== t));
  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'var(--paper-deep)', border: '1px solid var(--card-edge)', borderRadius: '2px', padding: '3px 8px', fontSize: '0.78rem', color: 'var(--ink)' }}>
            {t}
            <button type="button" onClick={() => remove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'flex' }}><X size={10}/></button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <input {...inp} value={input} placeholder={placeholder || 'Type and press Add'}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={add} style={{ padding: '0.4rem 0.8rem', flexShrink: 0 }}>
          <Plus size={13} />
        </button>
      </div>
    </Field>
  );
}

function SaveRow({ saving, onSave, flash, error, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', paddingTop: '1rem', borderTop: '1px solid var(--rule)', marginTop: '1.25rem' }}>
      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
        {saving ? 'Saving…' : 'Save changes'}
      </button>
      {flash && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--risk-low)', fontSize: '0.82rem', fontWeight: 600 }}>
          <CheckCircle2 size={14} /> {flash}
        </span>
      )}
      {error && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--risk-high)', fontSize: '0.82rem' }}>
          <AlertTriangle size={14} /> {error}
        </span>
      )}
      {note && <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', display: 'flex', alignItems: 'center', gap: '4px' }}><Info size={11}/>{note}</span>}
    </div>
  );
}

// ─── Score banner ─────────────────────────────────────────────────────────────
function ScoreBanner({ analysis, prev6m }) {
  const pred = analysis?.prediction || {};
  const band = pred.risk_band || 'MEDIUM';
  const prob6 = Math.round((pred.placement_probability?.['6m'] || 0) * 100);
  const drivers = analysis?.explainability?.top_drivers || [];
  const delta = prev6m != null ? Math.round((pred.placement_probability?.['6m'] - prev6m) * 100) : null;
  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderLeft: `4px solid ${bandColor(band)}` }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title" style={{ marginBottom: '0.35rem' }}><ShieldAlert size={13} /> Risk band</div>
            <span className={`badge badge-${band.toLowerCase()}`} style={{ fontSize: '0.9rem', padding: '0.3rem 0.8rem' }}>{band}</span>
          </div>
          <div>
            <div className="card-title" style={{ marginBottom: '0.35rem' }}>6-month placement</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', lineHeight: 1, color: bandColor(band), fontWeight: 400 }}>{prob6}%</span>
              {delta != null && delta !== 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem', fontWeight: 700,
                  color: delta > 0 ? 'var(--risk-low)' : 'var(--risk-high)' }}>
                  {delta > 0 ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
                  {delta > 0 ? '+' : ''}{delta}pp
                </span>
              )}
              {delta === 0 && prev6m != null && <Minus size={13} color="var(--ink-faint)" />}
            </div>
          </div>
        </div>
        {drivers.length > 0 && (
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div className="card-title" style={{ marginBottom: '0.4rem' }}>Top risk drivers</div>
            {drivers.slice(0, 3).map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', fontSize: '0.78rem', color: 'var(--ink-soft)', marginBottom: '0.2rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: d.impact_direction === 'Positive' ? 'var(--risk-low)' : 'var(--risk-high)' }} />
                {d.description || d.readable_name}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Personal ────────────────────────────────────────────────────────────
function PersonalTab({ data, onChange, onSave, saving, flash, error }) {
  const s = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div>
      <div className="apply-grid">
        <Field label="Full name"><input {...inp} value={data.full_name || ''} onChange={e => s('full_name', e.target.value)} placeholder="Aarav Sharma" /></Field>
        <Field label="Email"><input {...inp} type="email" value={data.email || ''} onChange={e => s('email', e.target.value)} placeholder="aarav@example.com" /></Field>
        <Field label="Mobile number"><input {...inp} type="tel" value={data.mobile || ''} onChange={e => s('mobile', e.target.value)} placeholder="+91 98765 43210" /></Field>
        <Field label="City"><input {...inp} value={data.city || ''} onChange={e => s('city', e.target.value)} placeholder="Pune" /></Field>
        <Field label="State">
          <select {...inp} value={data.state || ''} onChange={e => s('state', e.target.value)}>
            <option value="">Select state…</option>
            {INDIA_STATES.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </Field>
        <Field label="Country of study">
          <select {...inp} value={data.country_of_study || 'India'} onChange={e => s('country_of_study', e.target.value)}>
            {['India', 'USA', 'UK', 'Canada', 'Australia', 'Germany', 'Singapore', 'Other'].map(c => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Expected graduation year"><input {...inp} type="number" min={2020} max={2035} value={data.graduation_year || ''} onChange={e => s('graduation_year', parseInt(e.target.value) || null)} placeholder="2026" /></Field>
      </div>
      <SaveRow saving={saving} onSave={onSave} flash={flash} error={error} />
    </div>
  );
}

// ─── Tab: Academic ────────────────────────────────────────────────────────────
function AcademicTab({ data, onChange, onSave, saving, flash, error }) {
  const s = (k, v) => onChange({ ...data, [k]: v });
  const [newAch, setNewAch] = useState('');
  const [newSem, setNewSem] = useState({ semester: '', gpa: '' });

  const addSem = () => {
    if (!newSem.semester || !newSem.gpa) return;
    const existing = (data.semester_gpas || []).filter(x => x.semester !== parseInt(newSem.semester));
    s('semester_gpas', [...existing, { semester: parseInt(newSem.semester), gpa: parseFloat(newSem.gpa) }].sort((a, b) => a.semester - b.semester));
    setNewSem({ semester: '', gpa: '' });
  };
  const removeSem = idx => s('semester_gpas', (data.semester_gpas || []).filter((_, i) => i !== idx));

  const addAch = () => { if (newAch.trim()) { s('achievements', [...(data.achievements || []), newAch.trim()]); setNewAch(''); } };
  const removeAch = i => s('achievements', (data.achievements || []).filter((_, j) => j !== i));

  return (
    <div>
      <div className="apply-grid">
        <Slider label={`Current CGPA · ${Number(data.cgpa ?? 0).toFixed(1)}`}
          value={data.cgpa ?? 0} min={0} max={10} step={0.1}
          onChange={v => s('cgpa', v)}
          hint="Affects your placement-risk score immediately on save." />
        <Field label="Active backlogs" hint="≥ 2 forces HIGH risk band regardless of CGPA.">
          <input {...inp} type="number" min={0} max={20} value={data.backlogs_count ?? 0} onChange={e => s('backlogs_count', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Attendance %">
          <input {...inp} type="number" min={0} max={100} step={0.5} value={data.attendance_percentage ?? ''} onChange={e => s('attendance_percentage', parseFloat(e.target.value) || null)} placeholder="e.g. 82.5" />
        </Field>
        <Field label="Entrance exam score (GRE / CAT / JEE)">
          <input {...inp} type="number" min={0} value={data.entrance_exam_score ?? ''} onChange={e => s('entrance_exam_score', parseFloat(e.target.value) || null)} placeholder="e.g. 320" />
        </Field>
        <Field label="Research papers published">
          <input {...inp} type="number" min={0} value={data.research_papers ?? 0} onChange={e => s('research_papers', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Academic projects completed">
          <input {...inp} type="number" min={0} value={data.projects_count ?? 0} onChange={e => s('projects_count', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Awards / recognitions">
          <input {...inp} type="number" min={0} value={data.awards_count ?? 0} onChange={e => s('awards_count', parseInt(e.target.value) || 0)} />
        </Field>
      </div>

      {/* Semester-wise GPA */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title" style={{ marginBottom: '0.75rem' }}><GraduationCap size={13} /> Semester-wise GPA</div>
        {(data.semester_gpas || []).length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem', marginBottom: '0.75rem' }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '5px 8px', color: 'var(--ink-faint)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Semester</th>
              <th style={{ textAlign: 'left', padding: '5px 8px', color: 'var(--ink-faint)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>GPA</th>
              <th style={{ width: 32 }}></th>
            </tr></thead>
            <tbody>
              {(data.semester_gpas || []).map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--rule)' }}>
                  <td style={{ padding: '5px 8px', color: 'var(--ink)' }}>Semester {row.semester}</td>
                  <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)', color: 'var(--signal)' }}>{row.gpa}</td>
                  <td><button type="button" onClick={() => removeSem(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--risk-high)' }}><X size={13}/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input className="select-input" type="number" min={1} max={12} value={newSem.semester} placeholder="Sem #" onChange={e => setNewSem(p => ({ ...p, semester: e.target.value }))} style={{ width: '90px' }} />
          <input className="select-input" type="number" min={0} max={10} step={0.01} value={newSem.gpa} placeholder="GPA" onChange={e => setNewSem(p => ({ ...p, gpa: e.target.value }))} style={{ width: '90px' }} />
          <button type="button" className="btn btn-ghost" onClick={addSem}><Plus size={13}/> Add</button>
        </div>
      </div>

      {/* Achievements */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title" style={{ marginBottom: '0.75rem' }}><Award size={13} /> Achievements / Awards</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
          {(data.achievements || []).map((a, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'var(--paper-deep)', border: '1px solid var(--card-edge)', borderRadius: '2px', padding: '3px 9px', fontSize: '0.8rem', color: 'var(--ink)' }}>
              {a} <button type="button" onClick={() => removeAch(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'flex' }}><X size={11}/></button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="select-input" value={newAch} placeholder="e.g. Dean's List, Hackathon Winner…" onChange={e => setNewAch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAch(); } }} style={{ flex: 1 }} />
          <button type="button" className="btn btn-ghost" onClick={addAch}><Plus size={13}/> Add</button>
        </div>
      </div>

      <SaveRow saving={saving} onSave={onSave} flash={flash} error={error}
        note="Saves CGPA and backlogs — your risk score updates on the lender side immediately." />
    </div>
  );
}

// ─── Tab: Employability ───────────────────────────────────────────────────────
function EmployabilityTab({ data, onChange, onSave, saving, flash, error }) {
  const s = (k, v) => onChange({ ...data, [k]: v });

  // ── Internship sub-form ──
  const blankInt = { company_name: '', role: '', duration_months: '', tier: 'MNC', performance_score: '', description: '' };
  const [showAddInt, setShowAddInt] = useState(false);
  const [newInt, setNewInt] = useState(blankInt);

  const addInternship = () => {
    if (!newInt.company_name.trim()) return;
    s('internships', [...(data.internships || []), {
      ...newInt,
      duration_months: parseInt(newInt.duration_months) || 0,
      performance_score: parseFloat(newInt.performance_score) || null,
    }]);
    setNewInt(blankInt); setShowAddInt(false);
  };
  const removeInternship = i => s('internships', (data.internships || []).filter((_, j) => j !== i));

  // ── Certification sub-form ──
  const blankCert = { name: '', org: '', date: '', url: '' };
  const [showAddCert, setShowAddCert] = useState(false);
  const [newCert, setNewCert] = useState(blankCert);

  const addCert = () => {
    if (!newCert.name.trim()) return;
    s('certifications', [...(data.certifications || []), newCert]);
    setNewCert(blankCert); setShowAddCert(false);
  };
  const removeCert = i => s('certifications', (data.certifications || []).filter((_, j) => j !== i));

  // ── Project sub-form ──
  const blankProj = { name: '', tech_stack: '', description: '', url: '' };
  const [showAddProj, setShowAddProj] = useState(false);
  const [newProj, setNewProj] = useState(blankProj);

  const addProject = () => {
    if (!newProj.name.trim()) return;
    s('projects', [...(data.projects || []), newProj]);
    setNewProj(blankProj); setShowAddProj(false);
  };
  const removeProject = i => s('projects', (data.projects || []).filter((_, j) => j !== i));

  const totalIntMonths = (data.internships || []).reduce((acc, i) => acc + (parseInt(i.duration_months) || 0), 0);

  return (
    <div>
      {/* Internships */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title"><Briefcase size={13} /> Internships
            {totalIntMonths > 0 && <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--signal)', marginLeft: '0.6rem', fontWeight: 400 }}>{totalIntMonths} months total → affects score</span>}
          </div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setShowAddInt(v => !v)}>
            <Plus size={13}/> Add
          </button>
        </div>

        {(data.internships || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem', background: 'var(--paper-deep)', border: '1px solid var(--card-edge)', borderRadius: '3px', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>{item.company_name}
                <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 400, color: 'var(--ink-faint)' }}>{item.role}</span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
                {item.duration_months} months · {item.tier}
                {item.performance_score && ` · Score: ${item.performance_score}/100`}
              </div>
              {item.description && <div style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginTop: '3px', fontStyle: 'italic' }}>{item.description}</div>}
            </div>
            <button type="button" onClick={() => removeInternship(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--risk-high)', padding: '2px', flexShrink: 0 }}><X size={15}/></button>
          </div>
        ))}

        {showAddInt && (
          <div style={{ padding: '0.85rem', border: '1px dashed var(--card-edge-strong)', borderRadius: '3px', marginTop: '0.5rem' }}>
            <div className="apply-grid" style={{ marginBottom: '0.5rem' }}>
              <Field label="Company name"><input {...inp} value={newInt.company_name} onChange={e => setNewInt(p => ({ ...p, company_name: e.target.value }))} placeholder="e.g. Infosys" /></Field>
              <Field label="Role / designation"><input {...inp} value={newInt.role} onChange={e => setNewInt(p => ({ ...p, role: e.target.value }))} placeholder="e.g. SDE Intern" /></Field>
              <Field label="Duration (months)"><input {...inp} type="number" min={1} max={24} value={newInt.duration_months} onChange={e => setNewInt(p => ({ ...p, duration_months: e.target.value }))} /></Field>
              <Field label="Company tier">
                <select {...inp} value={newInt.tier} onChange={e => setNewInt(p => ({ ...p, tier: e.target.value }))}>
                  {INTERNSHIP_TIERS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Performance score (0–100)"><input {...inp} type="number" min={0} max={100} value={newInt.performance_score} placeholder="optional" onChange={e => setNewInt(p => ({ ...p, performance_score: e.target.value }))} /></Field>
              <Field label="Description (optional)"><input {...inp} value={newInt.description} onChange={e => setNewInt(p => ({ ...p, description: e.target.value }))} placeholder="brief description…" /></Field>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={addInternship} style={{ fontSize: '0.8rem' }}><CheckCircle2 size={13}/> Add internship</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddInt(false)} style={{ fontSize: '0.8rem' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Certifications */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title"><Award size={13} /> Certifications
            {(data.certifications || []).length > 0 && <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--signal)', marginLeft: '0.6rem', fontWeight: 400 }}>+{(data.certifications || []).length * 5}pp activity boost on save</span>}
          </div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setShowAddCert(v => !v)}>
            <Plus size={13}/> Add
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: (data.certifications || []).length ? '0.75rem' : 0 }}>
          {(data.certifications || []).map((c, i) => (
            <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', background: 'var(--paper-deep)', border: '1px solid var(--card-edge)', borderRadius: '2px', padding: '5px 10px', fontSize: '0.8rem' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--ink-faint)' }}>{c.org}{c.date && ` · ${c.date}`}</div>
              </div>
              <button type="button" onClick={() => removeCert(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--risk-high)', padding: 0, display: 'flex' }}><X size={13}/></button>
            </div>
          ))}
        </div>

        {showAddCert && (
          <div style={{ padding: '0.85rem', border: '1px dashed var(--card-edge-strong)', borderRadius: '3px' }}>
            <div className="apply-grid" style={{ marginBottom: '0.5rem' }}>
              <Field label="Certification name"><input {...inp} value={newCert.name} onChange={e => setNewCert(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AWS Cloud Practitioner" /></Field>
              <Field label="Issuing organization"><input {...inp} value={newCert.org} onChange={e => setNewCert(p => ({ ...p, org: e.target.value }))} placeholder="e.g. Amazon / Coursera" /></Field>
              <Field label="Completion date"><input {...inp} type="date" value={newCert.date} onChange={e => setNewCert(p => ({ ...p, date: e.target.value }))} /></Field>
              <Field label="Certificate URL (optional)"><input {...inp} type="url" value={newCert.url} onChange={e => setNewCert(p => ({ ...p, url: e.target.value }))} placeholder="https://…" /></Field>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={addCert} style={{ fontSize: '0.8rem' }}><CheckCircle2 size={13}/> Add</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddCert(false)} style={{ fontSize: '0.8rem' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Projects */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title"><Code2 size={13} /> Projects</div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setShowAddProj(v => !v)}>
            <Plus size={13}/> Add
          </button>
        </div>

        {(data.projects || []).map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem', background: 'var(--paper-deep)', border: '1px solid var(--card-edge)', borderRadius: '3px', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>{p.name}</div>
              {p.tech_stack && <div style={{ fontSize: '0.72rem', color: 'var(--signal)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{p.tech_stack}</div>}
              {p.description && <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: '3px' }}>{p.description}</div>}
            </div>
            <button type="button" onClick={() => removeProject(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--risk-high)', padding: '2px', flexShrink: 0 }}><X size={15}/></button>
          </div>
        ))}

        {showAddProj && (
          <div style={{ padding: '0.85rem', border: '1px dashed var(--card-edge-strong)', borderRadius: '3px', marginTop: '0.5rem' }}>
            <div className="apply-grid" style={{ marginBottom: '0.5rem' }}>
              <Field label="Project name"><input {...inp} value={newProj.name} onChange={e => setNewProj(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AI Resume Screener" /></Field>
              <Field label="Tech stack"><input {...inp} value={newProj.tech_stack} onChange={e => setNewProj(p => ({ ...p, tech_stack: e.target.value }))} placeholder="Python, FastAPI, React…" /></Field>
              <Field label="Project / repository URL"><input {...inp} type="url" value={newProj.url} onChange={e => setNewProj(p => ({ ...p, url: e.target.value }))} placeholder="https://github.com/…" /></Field>
            </div>
            <Field label="Description">
              <textarea className="select-input" rows={2} value={newProj.description} onChange={e => setNewProj(p => ({ ...p, description: e.target.value }))} placeholder="What problem does it solve?" style={{ width: '100%', resize: 'vertical' }} />
            </Field>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={addProject} style={{ fontSize: '0.8rem' }}><CheckCircle2 size={13}/> Add</button>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddProj(false)} style={{ fontSize: '0.8rem' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Skills */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-title" style={{ marginBottom: '0.85rem' }}><Wrench size={13} /> Skills</div>
        <div className="apply-grid">
          <TagInput label={<><Code2 size={11} style={{ verticalAlign: '-2px', marginRight: '4px' }}/>Programming languages</>}
            tags={data.skills?.languages || []} onChange={v => s('skills', { ...data.skills, languages: v })} placeholder="Python, Java, C++…" />
          <TagInput label={<><Wrench size={11} style={{ verticalAlign: '-2px', marginRight: '4px' }}/>Technical skills</>}
            tags={data.skills?.technical || []} onChange={v => s('skills', { ...data.skills, technical: v })} placeholder="Machine Learning, SQL…" />
          <TagInput label={<><MessageSquare size={11} style={{ verticalAlign: '-2px', marginRight: '4px' }}/>Soft skills</>}
            tags={data.skills?.soft || []} onChange={v => s('skills', { ...data.skills, soft: v })} placeholder="Leadership, Communication…" />
          <TagInput label={<><Wrench size={11} style={{ verticalAlign: '-2px', marginRight: '4px' }}/>Tools & frameworks</>}
            tags={data.skills?.tools || []} onChange={v => s('skills', { ...data.skills, tools: v })} placeholder="Docker, React, TensorFlow…" />
        </div>
        <div className="apply-grid" style={{ marginTop: '0.5rem' }}>
          <Field label="LeetCode / HackerRank problems solved" hint="Shown on your lender profile.">
            <input {...inp} type="number" min={0} value={data.coding_problems_solved ?? 0} onChange={e => s('coding_problems_solved', parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Hackathons attended">
            <input {...inp} type="number" min={0} value={data.hackathons_attended ?? 0} onChange={e => s('hackathons_attended', parseInt(e.target.value) || 0)} />
          </Field>
        </div>
      </div>

      <SaveRow saving={saving} onSave={onSave} flash={flash} error={error}
        note="Internship total months, best employer tier, and certification count sync to the scoring engine on save." />
    </div>
  );
}

// ─── Tab: Placement ───────────────────────────────────────────────────────────
function PlacementTab({ data, onChange, onSave, saving, flash, error }) {
  const s = (k, v) => onChange({ ...data, [k]: v });
  return (
    <div>
      <div className="apply-grid">
        <Field label="Job applications submitted">
          <input {...inp} type="number" min={0} value={data.applications_submitted ?? 0}
            onChange={e => s('applications_submitted', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Interview status">
          <select {...inp} value={data.interview_status || ''} onChange={e => s('interview_status', e.target.value)}>
            {INTERVIEW_STATUSES.map(st => <option key={st} value={st}>{st || '— Not started —'}</option>)}
          </select>
        </Field>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.1rem' }}>
        {[
          { key: 'resume_uploaded', label: 'Resume uploaded / current', sub: 'Keep it updated for each application cycle.' },
          { key: 'offer_received', label: 'Offer received', sub: 'Toggle on once you have a formal offer letter.' },
          { key: 'placement_confirmed', label: 'Placement confirmed (joining)', sub: 'Marks you as placed on the lender dashboard — re-scores your loan risk.' },
        ].map(({ key, label, sub }) => (
          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', padding: '0.75rem 1rem', border: '1px solid var(--card-edge)', borderRadius: '3px', background: data[key] ? 'rgba(47,110,69,0.06)' : 'var(--paper-deep)' }}>
            <input type="checkbox" checked={!!data[key]} onChange={e => s(key, e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--risk-low)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>{label}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>{sub}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Offer details — shown when offer_received is true */}
      {data.offer_received && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--risk-low)' }}>
          <div className="card-title" style={{ marginBottom: '0.75rem' }}><Target size={13} /> Offer details</div>
          <div className="apply-grid">
            <Field label="Company name">
              <input {...inp} value={data.company_name || ''} onChange={e => s('company_name', e.target.value)} placeholder="TCS, Infosys, Startup Co…" />
            </Field>
            <Field label="Offered CTC (₹/year)" hint="Syncs to actual_salary and re-scores your loan risk when placement is confirmed.">
              <input {...inp} type="number" min={0} step={10000} value={data.offered_ctc || ''} onChange={e => s('offered_ctc', parseInt(e.target.value) || 0)} placeholder="e.g. 700000" />
            </Field>
            <Field label="Expected joining date">
              <input {...inp} type="date" value={data.joining_date || ''} onChange={e => s('joining_date', e.target.value)} />
            </Field>
          </div>
        </div>
      )}

      <SaveRow saving={saving} onSave={onSave} flash={flash} error={error}
        note={data.placement_confirmed && data.offered_ctc > 0
          ? 'Placement confirmed → actual salary and placed_6m will sync to the lender portfolio on save.'
          : 'Marking yourself placed updates the lender risk view immediately.'} />
    </div>
  );
}

// ─── Verification badge ───────────────────────────────────────────────────────
function VBadge({ status }) {
  const cfg = {
    VERIFIED:    { icon: CheckCircle2, color: 'var(--risk-low)',    label: 'Verified' },
    PENDING:     { icon: Clock,        color: 'var(--risk-medium)', label: 'Pending'  },
    DISCREPANCY: { icon: XCircle,      color: 'var(--risk-high)',   label: 'Mismatch' },
    UNVERIFIED:  { icon: Lock,         color: 'var(--ink-faint)',   label: 'Unverified'},
  }[status || 'UNVERIFIED'];
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem',
      fontWeight: 700, letterSpacing: '0.08em', color: cfg.color, textTransform: 'uppercase' }}>
      <Icon size={11} />{cfg.label}
    </span>
  );
}

// ─── Fetched academic record display ─────────────────────────────────────────
function CGPABar({ label, value, max = 10, color, isOfficial }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
        <span style={{ color: 'var(--ink-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {isOfficial && <ShieldCheck size={11} color={color}/>} {label}
        </span>
        <span className="mono" style={{ fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ height: '6px', background: 'var(--paper-deep)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--card-edge)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.5s ease' }}/>
      </div>
    </div>
  );
}

function DocRow({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.35rem 0', borderBottom: '1px solid var(--rule)', fontSize: '0.82rem', gap: '1rem' }}>
      <span style={{ color: 'var(--ink-muted)', flexShrink: 0 }}>{label}</span>
      <span className={mono ? 'mono' : ''} style={{ color: 'var(--ink)', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function FetchedRecordCard({ record, onDismiss }) {
  const { official_cgpa, reported_cgpa, delta, match, minor_mismatch, discrepancy,
          cgpa_source, abc_record, digilocker_document } = record;

  const matchColor = discrepancy ? 'var(--risk-high)' : minor_mismatch ? 'var(--risk-medium)' : 'var(--risk-low)';
  const matchBg    = discrepancy ? 'rgba(168,40,40,0.07)' : minor_mismatch ? 'rgba(165,117,31,0.07)' : 'rgba(47,110,69,0.07)';
  const matchNote  = abc_record?.comparison?.note || digilocker_document?.comparison?.note || '';

  return (
    <div className="card animate-fade-up" style={{ marginBottom: '1rem', border: `1px solid ${matchColor}`, borderRadius: '4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <ShieldCheck size={16} color={matchColor}/> Academic Record Retrieved
          </div>
          <div style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginTop: '3px' }}>
            CGPA source: <em>{cgpa_source}</em>
          </div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: '2px' }}>
          <X size={16}/>
        </button>
      </div>

      {/* CGPA comparison */}
      <div style={{ padding: '0.85rem', background: matchBg, borderRadius: '3px', marginBottom: '1rem', border: `1px solid ${matchColor}33` }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: matchColor, marginBottom: '0.75rem' }}>
          CGPA Comparison
        </div>
        <CGPABar label="Official (from academic records)" value={official_cgpa} color={matchColor} isOfficial />
        <CGPABar label="Self-reported (your profile)"     value={reported_cgpa} color="var(--ink-muted)" />
        <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.7rem', background: 'var(--card-raised)', borderRadius: '3px', fontSize: '0.8rem', color: matchColor, fontWeight: discrepancy ? 700 : 400 }}>
          {discrepancy    && <AlertTriangle size={12} style={{ verticalAlign: '-2px', marginRight: '5px' }}/>}
          {!discrepancy   && <CheckCircle2  size={12} style={{ verticalAlign: '-2px', marginRight: '5px' }}/>}
          {matchNote || (match ? 'CGPAs match.' : `Delta: ${delta} pts`)}
        </div>
      </div>

      {/* ABC record */}
      {abc_record && (
        <div style={{ marginBottom: digilocker_document ? '1rem' : 0 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--navy)', marginBottom: '0.5rem' }}>
            ABC Academic Bank Record
          </div>
          <div style={{ background: 'var(--paper-deep)', padding: '0.75rem', borderRadius: '3px', border: '1px solid var(--card-edge)' }}>
            <DocRow label="ABC ID"         value={abc_record.abc_id} mono />
            <DocRow label="Institution"    value={abc_record.institution} />
            <DocRow label="Program"        value={abc_record.program} />
            <DocRow label="Academic year"  value={abc_record.academic_year} />
            <DocRow label="Verified CGPA"  value={abc_record.verified_cgpa} mono />
            <DocRow label="Grade class"    value={abc_record.grade_class} />
            <DocRow label="Credits earned" value={abc_record.credits_earned} mono />
            <DocRow label="Status"         value={abc_record.passing_status} />
            <div style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', marginTop: '0.5rem', fontStyle: 'italic' }}>
              {abc_record.source}
            </div>
          </div>
        </div>
      )}

      {/* DigiLocker document */}
      {digilocker_document && (
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--navy)', marginBottom: '0.5rem' }}>
            DigiLocker Document
          </div>
          <div style={{ background: 'var(--paper-deep)', padding: '0.75rem', borderRadius: '3px', border: '1px solid var(--card-edge)' }}>
            <DocRow label="Document type"   value={digilocker_document.document_type} />
            <DocRow label="URN"             value={digilocker_document.urn} mono />
            <DocRow label="Issuer"          value={digilocker_document.issuer} />
            <DocRow label="Institution"     value={digilocker_document.institution} />
            <DocRow label="Program"         value={digilocker_document.program} />
            <DocRow label="CGPA on document" value={digilocker_document.cgpa_on_document} mono />
            <DocRow label="Digitally signed" value={digilocker_document.digitally_signed ? 'Yes' : 'No'} />
            {(digilocker_document.semester_breakdown || []).length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-faint)', marginBottom: '0.35rem' }}>
                  Semester breakdown (from document)
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {digilocker_document.semester_breakdown.map((s) => (
                    <span key={s.semester} className="mono" style={{ fontSize: '0.76rem', padding: '2px 8px', background: 'var(--card-raised)', border: '1px solid var(--card-edge)', borderRadius: '2px', color: 'var(--ink)' }}>
                      Sem {s.semester}: {s.gpa}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: '0.66rem', color: 'var(--ink-faint)', marginTop: '0.5rem', fontStyle: 'italic' }}>
              {digilocker_document.source}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Verification ────────────────────────────────────────────────────────
// This component owns its own `verif` state — seeded from the parent prop once
// on mount, then updated directly from API responses. This means verification
// actions NEVER trigger the parent's `setLoading(true)`, so the tab stays
// mounted and all form state is preserved between actions.
function VerificationTab({ sid, richProfile, initialVerif, onVerifUpdate }) {
  // Local state seeded from parent prop; syncs when parent re-fetches full profile
  const [verif,        setVerif]        = useState(initialVerif || {});
  const [submitting,   setSubmitting]   = useState({});
  const [flash,        setFlash]        = useState({});
  const [errors,       setErrors]       = useState({});
  const [fetchedRecord, setFetchedRecord] = useState(null);  // last fetch result to show

  // ABC ID / DigiLocker inputs — pre-seeded with already-stored values
  const [abcId,   setAbcId]  = useState(initialVerif?.academic?.abc_id || '');
  const [digiId,  setDigiId] = useState(initialVerif?.academic?.digilocker_id || '');

  // Per-cert / per-internship inline forms
  const [certForms, setCertForms] = useState({});
  const [intForms,  setIntForms]  = useState({});

  // When parent does a full reload (e.g. after a profile save), sync local state
  useEffect(() => {
    if (initialVerif) {
      setVerif(initialVerif);
      setAbcId(initialVerif?.academic?.abc_id || '');
      setDigiId(initialVerif?.academic?.digilocker_id || '');
    }
  }, [initialVerif]);

  // Lightweight refresh — hits only /verification, never triggers page spinner
  const refreshVerif = useCallback(async () => {
    try {
      const r = await axios.get(`${API_BASE}/api/v1/student/${sid}/verification`);
      setVerif(r.data);
      onVerifUpdate?.(r.data);   // keep parent state in sync
    } catch {}
  }, [sid, onVerifUpdate]);

  const flashSet = (k, msg) => {
    setFlash(f => ({ ...f, [k]: msg }));
    setTimeout(() => setFlash(f => ({ ...f, [k]: null })), 5000);
  };
  const sub = (k, v) => setSubmitting(s => ({ ...s, [k]: v }));

  // ── Academic submit ────────────────────────────────────────────────────────
  const submitAcademic = async () => {
    const abc  = abcId.trim().toUpperCase().replace(/-/g, '');
    const digi = digiId.trim();
    if (!abc && !digi) return;
    setErrors(e => ({ ...e, academic: null }));
    setFetchedRecord(null);
    sub('academic', true);
    try {
      const r = await axios.post(`${API_BASE}/api/v1/student/${sid}/verify/academic`,
        { abc_id: abc || null, digilocker_id: digi || null });
      // Store the fetched document record for display
      setFetchedRecord(r.data.fetched_record || null);
      // Update local verif state directly — no page spinner triggered
      const updated = { ...r.data };
      delete updated.fetched_record;
      setVerif(updated);
      onVerifUpdate?.(updated);
      const fr = r.data.fetched_record;
      const msg = fr?.discrepancy
        ? `Verified — CGPA mismatch flagged (official ${fr.official_cgpa} vs reported ${fr.reported_cgpa})`
        : fr?.minor_mismatch
        ? `Verified — minor rounding difference (${fr.delta} pts)`
        : 'Academic data verified. CGPA confirmed.';
      flashSet('academic', msg);
    } catch (e) {
      setErrors(v => ({ ...v, academic: e?.response?.data?.detail || 'Submission failed.' }));
    } finally { sub('academic', false); }
  };

  // ── Certification submit ───────────────────────────────────────────────────
  const submitCert = async (idx, cert) => {
    const f = certForms[idx] || {};
    if (!f.credential_url?.trim() && !f.credential_id?.trim()) {
      setErrors(v => ({ ...v, [`cert_${idx}`]: 'Enter a credential URL or ID.' }));
      return;
    }
    setErrors(v => ({ ...v, [`cert_${idx}`]: null }));
    sub(`cert_${idx}`, true);
    try {
      const r = await axios.post(`${API_BASE}/api/v1/student/${sid}/verify/certification`, {
        cert_index: idx, cert_name: cert?.name || '',
        credential_id:  f.credential_id?.trim()  || null,
        credential_url: f.credential_url?.trim() || null,
      });
      setVerif(r.data);
      onVerifUpdate?.(r.data);
      const auto = r.data?.certifications?.[String(idx)]?.auto_verified;
      flashSet(`cert_${idx}`, auto ? 'Auto-verified instantly.' : 'Submitted — pending manual review.');
      // Clear the form for this cert
      setCertForms(p => ({ ...p, [idx]: {} }));
    } catch (e) {
      setErrors(v => ({ ...v, [`cert_${idx}`]: e?.response?.data?.detail || 'Failed.' }));
    } finally { sub(`cert_${idx}`, false); }
  };

  // ── Internship proof submit ────────────────────────────────────────────────
  const submitInt = async (idx, item) => {
    const f = intForms[idx] || {};
    if (!f.document_ref?.trim()) {
      setErrors(v => ({ ...v, [`int_${idx}`]: 'Enter the offer letter or completion cert reference.' }));
      return;
    }
    setErrors(v => ({ ...v, [`int_${idx}`]: null }));
    sub(`int_${idx}`, true);
    try {
      const r = await axios.post(`${API_BASE}/api/v1/student/${sid}/verify/internship`, {
        internship_index: idx,
        company_name:  item?.company_name || '',
        document_ref:  f.document_ref.trim(),
        contact_email: f.contact_email?.trim() || null,
      });
      setVerif(r.data);
      onVerifUpdate?.(r.data);
      flashSet(`int_${idx}`, 'Proof submitted — your RM will approve within 2-3 business days.');
      setIntForms(p => ({ ...p, [idx]: {} }));
    } catch (e) {
      setErrors(v => ({ ...v, [`int_${idx}`]: e?.response?.data?.detail || 'Failed.' }));
    } finally { sub(`int_${idx}`, false); }
  };

  // ── Derived display values ─────────────────────────────────────────────────
  const conf  = verif?.confidence      || {};
  const acad  = verif?.academic        || {};
  const ints  = verif?.internships     || {};
  const certs = verif?.certifications  || {};
  const plac  = verif?.placement       || {};

  const internships = richProfile?.employability?.internships    || [];
  const certList    = richProfile?.employability?.certifications || [];
  const tierColor = conf.tier === 'HIGH' ? 'var(--risk-low)' : conf.tier === 'MEDIUM' ? 'var(--risk-medium)' : 'var(--risk-high)';
  const abcVerified  = acad.abc_id_status      === 'VERIFIED';
  const digiVerified = acad.digilocker_status  === 'VERIFIED';
  const allAcadVerified = abcVerified && digiVerified;

  return (
    <div>

      {/* ── Confidence hero ───────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.25rem', borderLeft: `4px solid ${tierColor}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
          <div>
            <div className="card-title" style={{ marginBottom: '0.5rem' }}>
              <ShieldCheck size={13}/> Verification confidence
              <button onClick={refreshVerif} style={{ marginLeft: '0.6rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0, display: 'inline-flex' }} title="Refresh">
                <RefreshCw size={12}/>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', lineHeight: 1, color: tierColor, fontWeight: 400 }}>
                {conf.score ?? 0}
              </span>
              <span style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>/ 100 · <strong style={{ color: tierColor }}>{conf.tier || 'LOW'}</strong></span>
            </div>
            <div style={{ marginTop: '0.5rem', height: '7px', width: '220px', background: 'var(--paper-deep)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--card-edge)' }}>
              <div style={{ height: '100%', width: `${conf.score ?? 0}%`, background: tierColor, transition: 'width 0.4s ease' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.6rem', flex: 1, minWidth: '280px' }}>
            {[
              { label: 'ABC ID',      pts: conf.breakdown?.academic_abc        ?? 0, max: 25 },
              { label: 'DigiLocker', pts: conf.breakdown?.academic_digilocker  ?? 0, max: 15 },
              { label: 'Internships', pts: conf.breakdown?.internships          ?? 0, max: 25 },
              { label: 'Certs',       pts: conf.breakdown?.certifications       ?? 0, max: 20 },
              { label: 'Placement',   pts: conf.breakdown?.placement            ?? 0, max: 15 },
            ].map(({ label, pts, max }) => (
              <div key={label} style={{ textAlign: 'center', padding: '0.5rem 0.4rem', background: pts > 0 ? 'rgba(47,110,69,0.07)' : 'var(--paper-deep)', border: `1px solid ${pts > 0 ? 'rgba(47,110,69,0.2)' : 'var(--card-edge)'}`, borderRadius: '3px' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem', color: pts > 0 ? 'var(--risk-low)' : 'var(--ink-faint)' }}>
                  {pts}<span style={{ color: 'var(--ink-faint)', fontWeight: 400, fontSize: '0.68rem' }}>/{max}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {acad.discrepancy && (
          <div style={{ marginTop: '0.85rem', padding: '0.6rem 0.9rem', background: 'rgba(168,40,40,0.08)', border: '1px solid rgba(168,40,40,0.25)', borderRadius: '3px', fontSize: '0.82rem', color: 'var(--risk-high)' }}>
            <AlertTriangle size={13} style={{ verticalAlign: '-2px', marginRight: '6px' }}/>
            <strong>CGPA discrepancy detected:</strong> ABC-verified at {acad.verified_cgpa} — current CGPA ({acad.current_cgpa_vs_verified}) differs by {acad.discrepancy_delta} points. Your lender sees this flag.
          </div>
        )}
      </div>

      {/* ── Academic Verification ─────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div className="card-title">
            <GraduationCap size={13}/> Academic Verification
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <VBadge status={abcVerified ? 'VERIFIED' : 'UNVERIFIED'} /> ABC
            <span style={{ color: 'var(--ink-faint)', fontSize: '0.74rem' }}>·</span>
            <VBadge status={digiVerified ? 'VERIFIED' : 'UNVERIFIED'} /> DigiLocker
          </div>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
          <strong>ABC ID</strong> (Academic Bank of Credits) is a 12-character alphanumeric ID issued by your college.
          Find it in your <em>DigiLocker account → Academic → ABC</em>, or ask your college registrar.
          <br/>
          <strong>DigiLocker URN</strong> — the document identifier (e.g. <span className="mono" style={{ fontSize: '0.76em' }}>in.gov.digilocker.ABC123456789</span>) of your degree or marksheet, found in your DigiLocker document list.
        </p>

        <div className="apply-grid" style={{ marginBottom: '0.85rem' }}>
          {/* ABC ID */}
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: abcVerified ? 'var(--risk-low)' : 'var(--ink-faint)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {abcVerified && <CheckCircle2 size={11}/>} ABC ID (12 chars)
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input className="select-input mono" value={abcId}
                onChange={e => setAbcId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                maxLength={12} placeholder="e.g. ABC123DEF456"
                style={{ flex: 1, letterSpacing: '0.1em', fontSize: '0.92rem' }}
                disabled={abcVerified} />
              {abcVerified && <CheckCircle2 size={20} color="var(--risk-low)" style={{ alignSelf: 'center', flexShrink: 0 }}/>}
            </div>
            {abcVerified && <div style={{ fontSize: '0.72rem', color: 'var(--risk-low)', marginTop: '0.3rem' }}>Verified at CGPA {acad.verified_cgpa}. Locked.</div>}
            {!abcVerified && abcId.length > 0 && abcId.length < 12 && (
              <div style={{ fontSize: '0.7rem', color: 'var(--risk-medium)', marginTop: '0.25rem' }}>{12 - abcId.length} more characters needed</div>
            )}
          </div>

          {/* DigiLocker URN */}
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: digiVerified ? 'var(--risk-low)' : 'var(--ink-faint)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              {digiVerified && <CheckCircle2 size={11}/>} DigiLocker document URN
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input className="select-input" value={digiId}
                onChange={e => setDigiId(e.target.value)}
                placeholder="in.gov.digilocker.issuer.type.id"
                style={{ flex: 1 }}
                disabled={digiVerified} />
              {digiVerified && <CheckCircle2 size={20} color="var(--risk-low)" style={{ alignSelf: 'center', flexShrink: 0 }}/>}
            </div>
            {digiVerified && <div style={{ fontSize: '0.72rem', color: 'var(--risk-low)', marginTop: '0.3rem' }}>URN verified. Locked.</div>}
          </div>
        </div>

        {errors.academic && (
          <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(168,40,40,0.07)', border: '1px solid rgba(168,40,40,0.2)', borderRadius: '3px', fontSize: '0.8rem', color: 'var(--risk-high)', marginBottom: '0.75rem' }}>
            <AlertTriangle size={12} style={{ verticalAlign: '-2px', marginRight: '5px' }}/>{errors.academic}
          </div>
        )}
        {flash.academic && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--risk-low)', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            <CheckCircle2 size={14}/> {flash.academic}
          </div>
        )}

        {!allAcadVerified && (
          <button className="btn btn-primary" onClick={submitAcademic}
            disabled={submitting.academic || (!abcId.trim() && !digiId.trim())}
            style={{ opacity: (!abcId.trim() && !digiId.trim()) ? 0.5 : 1 }}>
            {submitting.academic
              ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }}/> Verifying…</>
              : <><ShieldCheck size={14}/> Submit verification</>}
          </button>
        )}
        {allAcadVerified && !fetchedRecord && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: 'var(--risk-low)', fontSize: '0.84rem', fontWeight: 600, padding: '0.4rem 0.85rem', border: '1px solid rgba(47,110,69,0.3)', borderRadius: '3px', background: 'rgba(47,110,69,0.07)' }}>
            <CheckCircle2 size={15}/> Both academic sources verified. +40 confidence points.
          </div>
        )}
      </div>

      {/* ── Fetched document record ───────────────────────────────────────── */}
      {fetchedRecord && (
        <FetchedRecordCard record={fetchedRecord} onDismiss={() => setFetchedRecord(null)} />
      )}

      {/* ── Certification Verification ────────────────────────────────────── */}
      {certList.length > 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title" style={{ marginBottom: '0.5rem' }}><Award size={13}/> Certification Verification</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '1rem', lineHeight: 1.55 }}>
            Paste the public credential URL from the issuer's verify page. Coursera, AWS, Google Cloud, NPTEL, HackerRank, Microsoft, LinkedIn Learning, and 10+ others auto-verify instantly. Unknown issuers go to manual review (+1-2 days).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {certList.map((c, i) => {
              const vs = certs[String(i)] || {};
              const f  = certForms[i] || {};
              const verified = vs.status === 'VERIFIED';
              const pending  = vs.status === 'PENDING';
              return (
                <div key={i} style={{
                  padding: '0.85rem 1rem',
                  background: verified ? 'rgba(47,110,69,0.05)' : 'var(--paper-deep)',
                  border: `1px solid ${verified ? 'rgba(47,110,69,0.25)' : 'var(--card-edge)'}`,
                  borderRadius: '3px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: verified || pending ? '0' : '0.7rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>{c.name}</span>
                      {c.org && <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginLeft: '0.5em' }}>· {c.org}</span>}
                    </div>
                    <VBadge status={vs.status || 'UNVERIFIED'} />
                  </div>
                  {verified && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--risk-low)', marginTop: '4px' }}>
                      <CheckCircle2 size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }}/>
                      {vs.auto_verified ? `Auto-verified via ${vs.issuer}` : 'Manually verified'}
                      {vs.credential_url && <span style={{ marginLeft: '0.5em' }}>· <a href={vs.credential_url} target="_blank" rel="noreferrer" style={{ color: 'var(--risk-low)' }}>View certificate</a></span>}
                    </div>
                  )}
                  {pending && <div style={{ fontSize: '0.74rem', color: 'var(--risk-medium)', marginTop: '4px' }}><Clock size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }}/>Pending manual review — usually approved within 1-2 business days.</div>}
                  {!verified && !pending && (
                    <>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 2, minWidth: '180px' }}>
                          <div style={{ fontSize: '0.64rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>Credential URL <span style={{ color: 'var(--risk-low)' }}>(preferred)</span></div>
                          <input className="select-input" placeholder="https://coursera.org/verify/…" value={f.credential_url || ''}
                            onChange={e => setCertForms(p => ({ ...p, [i]: { ...p[i], credential_url: e.target.value } }))} style={{ width: '100%' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: '130px' }}>
                          <div style={{ fontSize: '0.64rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>Credential ID</div>
                          <input className="select-input" placeholder="e.g. XYZ12345" value={f.credential_id || ''}
                            onChange={e => setCertForms(p => ({ ...p, [i]: { ...p[i], credential_id: e.target.value } }))} style={{ width: '100%' }}/>
                        </div>
                        <button className="btn btn-ghost" onClick={() => submitCert(i, c)} disabled={submitting[`cert_${i}`]}
                          style={{ alignSelf: 'flex-end', flexShrink: 0, padding: '0.42rem 0.9rem', fontSize: '0.78rem' }}>
                          {submitting[`cert_${i}`]
                            ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }}/>
                            : <ShieldCheck size={12}/>} Verify
                        </button>
                      </div>
                      {errors[`cert_${i}`] && <div style={{ color: 'var(--risk-high)', fontSize: '0.74rem', marginTop: '0.4rem' }}>{errors[`cert_${i}`]}</div>}
                      {flash[`cert_${i}`]  && <div style={{ color: 'var(--risk-low)',  fontSize: '0.74rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={11}/>{flash[`cert_${i}`]}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--ink-faint)' }}>
          <div className="card-title"><Award size={13}/> Certification Verification</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.5rem' }}>
            Go to the <strong>Employability</strong> tab and add your certifications first — then come back here to verify each one.
          </p>
        </div>
      )}

      {/* ── Internship Verification ───────────────────────────────────────── */}
      {internships.length > 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="card-title" style={{ marginBottom: '0.5rem' }}><Briefcase size={13}/> Internship Verification</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: '1rem', lineHeight: 1.55 }}>
            Enter your offer letter reference number and completion certificate reference. Include the HR contact email if available. Your RM will verify and approve within 2–3 business days.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {internships.map((item, i) => {
              const vs = ints[String(i)] || {};
              const f  = intForms[i] || {};
              const verified = vs.status === 'VERIFIED';
              const pending  = vs.status === 'PENDING';
              return (
                <div key={i} style={{
                  padding: '0.85rem 1rem',
                  background: verified ? 'rgba(47,110,69,0.05)' : 'var(--paper-deep)',
                  border: `1px solid ${verified ? 'rgba(47,110,69,0.25)' : 'var(--card-edge)'}`,
                  borderRadius: '3px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: verified || pending ? '0' : '0.7rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>{item.company_name}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint)', marginLeft: '0.5em' }}>
                        {item.role && `${item.role} · `}{item.duration_months} months · {item.tier}
                      </span>
                    </div>
                    <VBadge status={vs.status || 'UNVERIFIED'} />
                  </div>
                  {verified && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--risk-low)', marginTop: '4px' }}>
                      <CheckCircle2 size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }}/>
                      Approved by {vs.verified_by || 'RM'}.
                      {vs.document_ref && <span style={{ marginLeft: '0.4em', color: 'var(--ink-faint)' }}>Ref: {vs.document_ref}</span>}
                    </div>
                  )}
                  {pending && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--risk-medium)', marginTop: '4px' }}>
                      <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '4px' }}/>
                      Proof submitted (ref: {vs.document_ref}) — awaiting RM approval.
                      {vs.contact_email && <span style={{ marginLeft: '0.4em', color: 'var(--ink-faint)' }}>· {vs.contact_email}</span>}
                    </div>
                  )}
                  {!verified && !pending && (
                    <>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 2, minWidth: '200px' }}>
                          <div style={{ fontSize: '0.64rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>Offer letter / completion cert reference <span style={{ color: 'var(--risk-high)' }}>*</span></div>
                          <input className="select-input" placeholder="e.g. OL-2024-INF-4521 · CC-DONE-7890" value={f.document_ref || ''}
                            onChange={e => setIntForms(p => ({ ...p, [i]: { ...p[i], document_ref: e.target.value } }))} style={{ width: '100%' }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: '160px' }}>
                          <div style={{ fontSize: '0.64rem', color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>HR contact email <span style={{ color: 'var(--ink-faint)' }}>(optional)</span></div>
                          <input className="select-input" placeholder="hr@company.com" type="email" value={f.contact_email || ''}
                            onChange={e => setIntForms(p => ({ ...p, [i]: { ...p[i], contact_email: e.target.value } }))} style={{ width: '100%' }}/>
                        </div>
                        <button className="btn btn-ghost" onClick={() => submitInt(i, item)} disabled={submitting[`int_${i}`]}
                          style={{ alignSelf: 'flex-end', flexShrink: 0, padding: '0.42rem 0.9rem', fontSize: '0.78rem' }}>
                          {submitting[`int_${i}`]
                            ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }}/>
                            : <ShieldCheck size={12}/>} Submit proof
                        </button>
                      </div>
                      {errors[`int_${i}`] && <div style={{ color: 'var(--risk-high)', fontSize: '0.74rem', marginTop: '0.4rem' }}>{errors[`int_${i}`]}</div>}
                      {flash[`int_${i}`]  && <div style={{ color: 'var(--risk-low)',  fontSize: '0.74rem', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '5px' }}><CheckCircle2 size={11}/>{flash[`int_${i}`]}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--ink-faint)' }}>
          <div className="card-title"><Briefcase size={13}/> Internship Verification</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.5rem' }}>
            Go to the <strong>Employability</strong> tab and add your internships first — then come back here to submit proof.
          </p>
        </div>
      )}

      {/* ── Placement Verification ────────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
          <div className="card-title"><Target size={13}/> Placement Verification</div>
          <VBadge status={plac.status || 'UNVERIFIED'} />
        </div>
        {plac.status === 'VERIFIED' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--risk-low)', fontSize: '0.84rem', fontWeight: 600 }}>
            <CheckCircle2 size={15}/>
            Confirmed by <strong>{plac.verified_by_institute}</strong> (college placement cell). +15 confidence points.
          </div>
        ) : (
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[
                { num: '01', text: 'Confirm your placement in the Placement tab (toggle "Placement confirmed" + enter CTC).' },
                { num: '02', text: 'Ask your college placement officer to log into the College portal and mark you as placed.' },
                { num: '03', text: 'The system auto-verifies placement the moment the college cell confirms — no extra step needed.' },
              ].map(({ num, text }) => (
                <div key={num} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--ink-faint)', fontWeight: 700, flexShrink: 0, marginTop: '2px' }}>{num}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyProfile() {
  const { user } = useAuth();
  const sid = user?.studentId;

  const [tab, setTab]               = useState('personal');
  const [baseProfile, setBase]        = useState(null);
  const [richProfile, setRich]        = useState(null);
  const [analysis, setAnalysis]       = useState(null);
  const [verification, setVerif]      = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  // Lightweight callback for VerificationTab — updates verification state without
  // triggering the full-page loading spinner (which would unmount the tab).
  const updateVerification = useCallback((v) => setVerif(v), []);

  // Per-tab editable copies
  const [personal,      setPersonal]      = useState(null);
  const [academic,      setAcademic]      = useState(null);
  const [employability, setEmployability] = useState(null);
  const [placement,     setPlacement]     = useState(null);

  // Per-tab save state
  const [saving, setSaving]   = useState({});
  const [flash,  setFlash]    = useState({});
  const [tabErr, setTabErr]   = useState({});
  const [prev6m, setPrev6m]   = useState(null);

  const load = useCallback(async () => {
    if (!sid) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await axios.get(`${API_BASE}/api/v1/student/${sid}/full-profile`);
      applyData(r.data);
      setError(null);
    } catch (e) {
      setError(e?.response?.status === 404
        ? `No borrower record found for ${sid}. Ask your lender to onboard you first.`
        : 'Cannot reach backend on port 8001.');
    } finally { setLoading(false); }
  }, [sid]);

  useEffect(() => { load(); }, [load]);

  function applyData(d) {
    setBase(d.profile);
    setRich(d.rich_profile);
    setAnalysis(d.analysis);
    setVerif(d.verification || null);
    const rp = d.rich_profile;
    setPersonal(rp?.personal || {});
    setAcademic(rp?.academic || {});
    setEmployability(rp?.employability || {});
    setPlacement(rp?.placement_activity || {});
  }

  async function saveTab(section, data) {
    setSaving(s => ({ ...s, [section]: true }));
    setTabErr(s => ({ ...s, [section]: null }));
    setFlash(s => ({ ...s, [section]: null }));
    setPrev6m(analysis?.prediction?.placement_probability?.['6m'] ?? null);
    try {
      const r = await axios.put(`${API_BASE}/api/v1/student/${sid}/full-profile`, { [section]: data });
      applyData(r);
      const synced = r.synced_to_scoring || [];
      setFlash(s => ({ ...s, [section]: synced.length
        ? `Saved · re-scored (synced: ${synced.join(', ')})`
        : 'Saved.' }));
    } catch (e) {
      setTabErr(s => ({ ...s, [section]: e?.response?.data?.detail || 'Save failed.' }));
    } finally {
      setSaving(s => ({ ...s, [section]: false }));
      setTimeout(() => setFlash(s => ({ ...s, [section]: null })), 5000);
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '4rem 2rem', color: 'var(--ink-muted)' }}>
      <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--signal)' }} />
      <span style={{ fontSize: '0.9rem' }}>Loading your profile…</span>
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem' }}>
      <div className="alert-banner alert-high">
        <AlertTriangle size={20} color="var(--risk-high)" />
        <div><strong>Profile unavailable</strong>
          <p style={{ marginTop: '0.25rem', color: 'var(--ink-muted)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-up">
      {/* Page header */}
      <div className="page-header">
        <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>My Profile</div>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <User size={26} color="var(--signal)" /> Your complete placement profile.
        </h1>
        <p style={{ marginTop: '0.55rem', maxWidth: '68ch' }}>
          Keep every section current — your lender's risk model re-scores the moment you save academic or employment changes.
          <span className="mono" style={{ marginLeft: '0.5em', color: 'var(--ink-faint)', fontSize: '0.82rem' }}>{sid}</span>
        </p>
      </div>

      {/* Live score banner */}
      {analysis && <ScoreBanner analysis={analysis} prev6m={prev6m} />}

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const flashKey = { personal: 'personal', academic: 'academic', employability: 'employability', placement: 'placement_activity' }[id];
          const confScore = verification?.confidence?.score ?? 0;
          const showVerifBadge = id === 'verification';
          const verifColor = confScore >= 80 ? 'var(--risk-low)' : confScore >= 50 ? 'var(--risk-medium)' : 'var(--risk-high)';
          return (
            <button key={id} onClick={() => setTab(id)}
              className={`badge ${tab === id ? 'badge-info' : ''}`}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                border: tab === id ? '1px solid var(--accent-primary)' : '1px solid var(--card-edge)',
                opacity: tab === id ? 1 : 0.65, fontSize: '0.82rem' }}>
              <Icon size={14} /> {label}
              {flashKey && flash[flashKey] && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--risk-low)', display: 'inline-block', marginLeft: '2px' }} />}
              {showVerifBadge && verification && (
                <span className="mono" style={{ fontSize: '0.68rem', color: verifColor, fontWeight: 700, marginLeft: '2px' }}>
                  {confScore}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="card">
        {tab === 'personal' && personal && (
          <PersonalTab data={personal} onChange={setPersonal}
            onSave={() => saveTab('personal', personal)}
            saving={saving.personal} flash={flash.personal} error={tabErr.personal} />
        )}
        {tab === 'academic' && academic && (
          <AcademicTab data={academic} onChange={setAcademic}
            onSave={() => saveTab('academic', academic)}
            saving={saving.academic} flash={flash.academic} error={tabErr.academic} />
        )}
        {tab === 'employability' && employability && (
          <EmployabilityTab data={employability} onChange={setEmployability}
            onSave={() => saveTab('employability', employability)}
            saving={saving.employability} flash={flash.employability} error={tabErr.employability} />
        )}
        {tab === 'placement' && placement && (
          <PlacementTab data={placement} onChange={setPlacement}
            onSave={() => saveTab('placement_activity', placement)}
            saving={saving.placement_activity} flash={flash.placement_activity} error={tabErr.placement_activity} />
        )}
        {tab === 'verification' && (
          <VerificationTab
            sid={sid}
            richProfile={richProfile}
            initialVerif={verification}
            onVerifUpdate={updateVerification}
          />
        )}
      </div>
    </div>
  );
}
