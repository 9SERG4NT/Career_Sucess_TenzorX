import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, ChevronLeft, CheckCircle2, GraduationCap, Wallet, FileText,
  Activity,
} from 'lucide-react';
import { API_BASE } from '../../App';
import { useAuth } from '../../context/AuthContext';

const COURSES = ['Engineering', 'MBA', 'Nursing'];
const TIERS = ['A', 'B', 'C', 'D'];
const REGIONS = ['Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai'];
const EMPLOYMENT_TYPES = ['Self', 'Salaried co-applicant', 'Business owner co-applicant', 'Other'];

const STEPS = [
  { num: '01', label: 'Academic',  icon: GraduationCap, key: 'academic' },
  { num: '02', label: 'Financial', icon: Wallet,        key: 'financial' },
  { num: '03', label: 'Review',    icon: FileText,      key: 'review' },
];

const DEFAULT_FORM = {
  course_type: 'Engineering',
  year: 'Final year',
  cgpa: 7.5,
  institute_name: 'NIT Pune',
  institute_tier: 'B',
  region: 'Pune',
  internship_months: 3,
  employer_tier: 'MNC',
  loan_amount: 600000,
  monthly_emi: 12000,
  co_applicant_income: 65000,
  employment_type: 'Salaried co-applicant',
};

export default function LoanApply() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));
  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        student_id: user?.studentId || 'STU-DEMO-PENDING',
        name: user?.name || 'Applicant',
        ...form,
      };
      const res = await axios.post(`${API_BASE}/api/v1/loan/prescreen`, payload);
      updateUser({ hasApplication: true, lastApplication: payload, lastPrescreen: res.data });
      navigate('/me/prescreen', { state: { result: res.data, application: payload } });
    } catch (e) {
      setError(e?.response?.data?.detail || 'Backend not reachable. Make sure FastAPI is running on port 8001.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="apply-page animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>01</span>
            Loan Application
          </div>
          <h1>Apply in three steps.</h1>
          <p style={{ marginTop: '0.55rem' }}>
            We use the same fields the lender's risk engine uses. After you submit you'll see your placement-risk pre-screen — instantly, in plain English.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="apply-stepper">
        {STEPS.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'pending';
          return (
            <button
              key={s.key}
              className={`apply-step apply-step-${state}`}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              type="button"
            >
              <span className="apply-step-num">№ {s.num}</span>
              <div className="apply-step-body">
                <span className="apply-step-icon">
                  {state === 'done' ? <CheckCircle2 size={14} /> : <s.icon size={14} />}
                </span>
                <span>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className="apply-step-rule" aria-hidden />}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 && (
          <motion.div key="step0" {...stepMotion} className="card apply-card">
            <SectionHead num="A" title="Academic profile" sub="Course, institute, grades, internships." />
            <div className="apply-grid">
              <Field label="Course type">
                <select className="select-input" value={form.course_type} onChange={e => update({ course_type: e.target.value })}>
                  {COURSES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Year">
                <select className="select-input" value={form.year} onChange={e => update({ year: e.target.value })}>
                  {['First year', 'Second year', 'Third year', 'Final year'].map(y => <option key={y}>{y}</option>)}
                </select>
              </Field>
              <Field label={`CGPA · ${form.cgpa.toFixed(1)} / 10`}>
                <input
                  type="range" min="4" max="10" step="0.1"
                  value={form.cgpa}
                  onChange={e => update({ cgpa: parseFloat(e.target.value) })}
                  className="apply-slider"
                />
              </Field>
              <Field label="Institute name">
                <input className="select-input" type="text" value={form.institute_name} onChange={e => update({ institute_name: e.target.value })} />
              </Field>
              <Field label="Institute tier">
                <select className="select-input" value={form.institute_tier} onChange={e => update({ institute_tier: e.target.value })}>
                  {TIERS.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Region">
                <select className="select-input" value={form.region} onChange={e => update({ region: e.target.value })}>
                  {REGIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label={`Internship months · ${form.internship_months}`}>
                <input
                  type="range" min="0" max="12" step="1"
                  value={form.internship_months}
                  onChange={e => update({ internship_months: parseInt(e.target.value, 10) })}
                  className="apply-slider"
                />
              </Field>
              <Field label="Preferred employer tier">
                <select className="select-input" value={form.employer_tier} onChange={e => update({ employer_tier: e.target.value })}>
                  {['MNC', 'Unicorn', 'MidSize', 'Local'].map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step1" {...stepMotion} className="card apply-card">
            <SectionHead num="B" title="Financial details" sub="Loan amount, EMI capacity, and co-applicant income." />
            <div className="apply-grid">
              <Field label={`Requested loan amount · ₹${form.loan_amount.toLocaleString('en-IN')}`}>
                <input
                  type="range" min="100000" max="2500000" step="50000"
                  value={form.loan_amount}
                  onChange={e => update({ loan_amount: parseInt(e.target.value, 10) })}
                  className="apply-slider"
                />
              </Field>
              <Field label={`Monthly EMI capacity · ₹${form.monthly_emi.toLocaleString('en-IN')}`}>
                <input
                  type="range" min="5000" max="40000" step="500"
                  value={form.monthly_emi}
                  onChange={e => update({ monthly_emi: parseInt(e.target.value, 10) })}
                  className="apply-slider"
                />
              </Field>
              <Field label="Co-applicant income (₹/month)">
                <input
                  className="select-input" type="number" min="0"
                  value={form.co_applicant_income}
                  onChange={e => update({ co_applicant_income: parseInt(e.target.value || 0, 10) })}
                />
              </Field>
              <Field label="Employment type">
                <select className="select-input" value={form.employment_type} onChange={e => update({ employment_type: e.target.value })}>
                  {EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" {...stepMotion} className="card apply-card">
            <SectionHead num="C" title="Review and submit" sub="Confirm what we'll feed the risk engine." />
            <div className="apply-review-grid">
              {[
                ['Course', form.course_type],
                ['Year', form.year],
                ['CGPA', form.cgpa.toFixed(1)],
                ['Institute', `${form.institute_name} · Tier ${form.institute_tier}`],
                ['Region', form.region],
                ['Internship', `${form.internship_months} months`],
                ['Employer tier', form.employer_tier],
                ['Loan amount', `₹${form.loan_amount.toLocaleString('en-IN')}`],
                ['Monthly EMI', `₹${form.monthly_emi.toLocaleString('en-IN')}`],
                ['Co-applicant', `₹${form.co_applicant_income.toLocaleString('en-IN')}/mo`],
                ['Employment', form.employment_type],
              ].map(([k, v]) => (
                <div key={k} className="apply-review-item">
                  <span className="apply-review-key">{k}</span>
                  <span className="apply-review-val">{v}</span>
                </div>
              ))}
            </div>
            {error && (
              <div className="alert-banner alert-high" style={{ marginTop: '1rem' }}>
                <div style={{ flex: 1 }}><strong>Couldn't submit.</strong><p style={{ marginTop: '0.25rem', color: 'var(--ink-muted)', fontSize: '0.85rem' }}>{error}</p></div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer nav */}
      <div className="apply-nav">
        <button
          className="btn btn-ghost"
          onClick={prev}
          disabled={step === 0}
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="apply-nav-pos">
          Step {step + 1} of {STEPS.length}
        </div>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={next}>
            Continue <ChevronRight size={14} />
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Scoring…
              </>
            ) : (
              <>
                Get my pre-screen <ChevronRight size={14} />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

const stepMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -16 },
  transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] },
};

function SectionHead({ num, title, sub }) {
  return (
    <div className="apply-section-head">
      <div className="eyebrow" style={{ color: 'var(--signal)' }}>
        <span style={{ marginRight: '0.4em' }}>§</span>{num}
      </div>
      <h3 style={{ margin: '0.25rem 0 0.3rem' }}>{title}</h3>
      <p style={{ color: 'var(--ink-muted)', fontSize: '0.86rem' }}>{sub}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="apply-field">
      <span className="apply-field-label">{label}</span>
      {children}
    </label>
  );
}
