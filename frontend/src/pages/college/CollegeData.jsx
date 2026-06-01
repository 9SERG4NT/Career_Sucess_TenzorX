import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Building2, Plus, Trash2, Save, Check, Briefcase, GraduationCap, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../App';

const TABS = [
  { id: 'profile',   label: 'Institute Profile', icon: Building2 },
  { id: 'programs',  label: 'Programs',          icon: GraduationCap },
  { id: 'recruiters',label: 'Recruiters',        icon: Briefcase },
  { id: 'students',  label: 'Student Status',    icon: Users },
];

const PROGRAM_COLS = [
  { key: 'program', label: 'Program', type: 'text' },
  { key: 'total_students', label: 'Total', type: 'number' },
  { key: 'placed', label: 'Placed', type: 'number' },
  { key: 'rate_3m', label: '3m (0-1)', type: 'number', step: '0.01' },
  { key: 'rate_6m', label: '6m (0-1)', type: 'number', step: '0.01' },
  { key: 'rate_12m', label: '12m (0-1)', type: 'number', step: '0.01' },
  { key: 'median_salary', label: 'Median ₹', type: 'number' },
  { key: 'highest_salary', label: 'Highest ₹', type: 'number' },
];
const RECRUITER_COLS = [
  { key: 'name', label: 'Recruiter', type: 'text' },
  { key: 'industry', label: 'Industry', type: 'text' },
  { key: 'openings', label: 'Openings', type: 'number' },
  { key: 'selected', label: 'Selected', type: 'number' },
];
const STUDENT_COLS = [
  { key: 'student_id', label: 'Student ID', type: 'text' },
  { key: 'status', label: 'Status', type: 'text' },
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'offered_salary', label: 'Offered ₹', type: 'number' },
];

const blank = (cols) => Object.fromEntries(cols.map((c) => [c.key, '']));

export default function CollegeData() {
  const { user } = useAuth();
  const institute = user?.institute || 'Demo Institute';

  const [tab, setTab] = useState('profile');
  const [tier, setTier] = useState('');
  const [accreditation, setAccreditation] = useState('');
  const [programs, setPrograms] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [students, setStudents] = useState([]);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/college/${encodeURIComponent(institute)}`)
      .then((r) => {
        const d = r.data || {};
        setTier(d.institute_tier || '');
        setAccreditation(d.accreditation || '');
        setPrograms(d.programs?.length ? d.programs : [blank(PROGRAM_COLS)]);
        setRecruiters(d.recruiters?.length ? d.recruiters : [blank(RECRUITER_COLS)]);
        setStudents(d.student_status?.length ? d.student_status : [blank(STUDENT_COLS)]);
      })
      .catch(() => {
        setPrograms([blank(PROGRAM_COLS)]);
        setRecruiters([blank(RECRUITER_COLS)]);
        setStudents([blank(STUDENT_COLS)]);
      });
  }, [institute]);

  const flash = (msg) => { setSaved(msg); setTimeout(() => setSaved(''), 2500); };

  const saveProfile = async () => {
    await axios.post(`${API_BASE}/api/v1/college/profile`, { institute_name: institute, institute_tier: tier, accreditation });
    flash('Profile saved');
  };
  const savePrograms = async () => {
    const clean = programs.filter((p) => String(p.program || '').trim());
    await axios.post(`${API_BASE}/api/v1/college/programs`, { institute_name: institute, programs: clean });
    flash(`Saved ${clean.length} program(s)`);
  };
  const saveRecruiters = async () => {
    const clean = recruiters.filter((r) => String(r.name || '').trim());
    await axios.post(`${API_BASE}/api/v1/college/recruiters`, { institute_name: institute, recruiters: clean });
    flash(`Saved ${clean.length} recruiter(s)`);
  };
  const saveStudents = async () => {
    const clean = students.filter((s) => String(s.student_id || '').trim());
    const r = await axios.post(`${API_BASE}/api/v1/college/student-status`, { institute_name: institute, students: clean });
    const synced = r.data?.synced_count || 0;
    flash(synced
      ? `Saved ${clean.length} record(s) · ${synced} matched a borrower → synced to the lender & re-scored`
      : `Saved ${clean.length} record(s). Use real STU-2026 IDs to sync placement back to the lender.`);
  };

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--ink)', margin: '0 0 4px' }}>
        <Building2 size={22} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--signal)' }} />
        Manage Placement Data
      </h1>
      <div style={{ color: 'var(--ink-faint)', fontSize: '0.82rem', marginBottom: '1.25rem' }}>{institute}</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`badge ${tab === t.id ? 'badge-info' : ''}`}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: tab === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--card-edge)', opacity: tab === t.id ? 1 : 0.7 }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {saved && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--risk-low)', fontSize: '0.82rem', marginBottom: '0.75rem', fontWeight: 600 }}>
          <Check size={14} /> {saved}
        </div>
      )}

      <div className="card">
        {tab === 'profile' && (
          <div style={{ maxWidth: 460 }}>
            <div className="card-title"><Building2 size={14} /> Institute Profile</div>
            <Field label="Institute Name">
              <input className="select-input" value={institute} disabled style={{ opacity: 0.7 }} />
            </Field>
            <Field label="Institute Tier">
              <select className="select-input" value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">Select tier…</option>
                {['A', 'B', 'C', 'D'].map((t) => <option key={t} value={t}>Tier {t}</option>)}
              </select>
            </Field>
            <Field label="Accreditation">
              <input className="select-input" placeholder="e.g. NAAC A+, NBA" value={accreditation} onChange={(e) => setAccreditation(e.target.value)} />
            </Field>
            <button className="btn btn-primary" onClick={saveProfile} style={{ marginTop: 8 }}><Save size={14} /> Save profile</button>
          </div>
        )}

        {tab === 'programs' && (
          <Editable title="Program-wise Placement & Salary" cols={PROGRAM_COLS} rows={programs} setRows={setPrograms} onSave={savePrograms} />
        )}
        {tab === 'recruiters' && (
          <Editable title="Recruiter Participation" cols={RECRUITER_COLS} rows={recruiters} setRows={setRecruiters} onSave={saveRecruiters} />
        )}
        {tab === 'students' && (
          <Editable title="Student Placement Status" cols={STUDENT_COLS} rows={students} setRows={setStudents} onSave={saveStudents} />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink-faint)', fontWeight: 700, marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}

function Editable({ title, cols, rows, setRows, onSave }) {
  const update = (i, key, val) => setRows(rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  const remove = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const addRow = () => setRows([...rows, blank(cols)]);

  return (
    <div>
      <div className="card-title">{title}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key} style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ink-faint)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</th>
              ))}
              <th style={{ width: 34 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key} style={{ padding: '4px 6px' }}>
                    <input
                      className="select-input"
                      type={c.type}
                      step={c.step}
                      value={row[c.key] ?? ''}
                      onChange={(e) => update(i, c.key, e.target.value)}
                      style={{ minWidth: c.type === 'number' ? 78 : 120, padding: '6px 8px' }}
                    />
                  </td>
                ))}
                <td style={{ textAlign: 'center' }}>
                  <button onClick={() => remove(i)} aria-label="Remove row"
                    style={{ background: 'transparent', border: 'none', color: 'var(--risk-high)', cursor: 'pointer' }}>
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <button className="btn" onClick={addRow} style={{ border: '1px solid var(--card-edge)' }}><Plus size={14} /> Add row</button>
        <button className="btn btn-primary" onClick={onSave}><Save size={14} /> Save</button>
      </div>
    </div>
  );
}
