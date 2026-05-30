import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Search, Filter, RefreshCw, ArrowUpDown, ArrowDown, ArrowUp,
  Users, ChevronRight, IndianRupee, Layers,
} from 'lucide-react';
import { API_BASE } from '../App';

const RISK_FROM_ROW = (r) => {
  // Mirror engine logic: HIGH if cgpa<5 & no internship, or EMI comfort poor.
  // Without scoring API, derive a coarse band from placement + salary + cgpa.
  if (r.placed_6m === 1 && r.cgpa >= 7) return { band: 'LOW', color: 'var(--risk-low)' };
  if (r.placed_12m === 1)               return { band: 'MEDIUM', color: 'var(--risk-medium)' };
  return { band: 'HIGH', color: 'var(--risk-high)' };
};

const COURSES = ['ALL', 'Engineering', 'MBA', 'Nursing'];
const REGIONS = ['ALL', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai'];
const TIERS   = ['ALL', 'A', 'B', 'C', 'D'];
const STATUS  = ['ALL', 'Placed (6m)', 'Placed (12m)', 'Unplaced'];

const COLUMNS = [
  { key: 'student_id',       label: 'Student ID',  numeric: false },
  { key: 'course_type',      label: 'Course',      numeric: false },
  { key: 'institute_tier',   label: 'Tier',        numeric: false },
  { key: 'region',           label: 'Region',      numeric: false },
  { key: 'cgpa',             label: 'CGPA',        numeric: true  },
  { key: 'internship_months',label: 'Intern (mo)', numeric: true  },
  { key: 'monthly_emi',      label: 'EMI ₹/mo',    numeric: true  },
  { key: 'actual_salary',    label: 'CTC ₹/yr',    numeric: true  },
  { key: '_risk',            label: 'Risk',        numeric: false },
];

export default function Portfolio() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState('');
  const [course, setCourse] = useState('ALL');
  const [region, setRegion] = useState('ALL');
  const [tier, setTier]     = useState('ALL');
  const [status, setStatus] = useState('ALL');

  const [sortKey, setSortKey] = useState('cgpa');
  const [sortDir, setSortDir] = useState('desc');

  const [page, setPage] = useState(0);
  const PAGE = 25;

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get(`${API_BASE}/api/v1/students`, { params: { limit: 300 } });
      setRows(res.data || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let out = rows;
    if (course !== 'ALL') out = out.filter(r => r.course_type === course);
    if (region !== 'ALL') out = out.filter(r => r.region === region);
    if (tier   !== 'ALL') out = out.filter(r => r.institute_tier === tier);
    if (status === 'Placed (6m)')  out = out.filter(r => r.placed_6m === 1);
    if (status === 'Placed (12m)') out = out.filter(r => r.placed_12m === 1 && r.placed_6m === 0);
    if (status === 'Unplaced')     out = out.filter(r => r.placed_12m === 0);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter(r =>
        r.student_id?.toLowerCase().includes(s) ||
        r.region?.toLowerCase().includes(s) ||
        r.course_type?.toLowerCase().includes(s)
      );
    }
    const sorted = [...out].sort((a, b) => {
      const ka = sortKey === '_risk' ? RISK_FROM_ROW(a).band : a[sortKey];
      const kb = sortKey === '_risk' ? RISK_FROM_ROW(b).band : b[sortKey];
      if (ka == null) return 1;
      if (kb == null) return -1;
      if (typeof ka === 'number' && typeof kb === 'number') {
        return sortDir === 'asc' ? ka - kb : kb - ka;
      }
      return sortDir === 'asc'
        ? String(ka).localeCompare(String(kb))
        : String(kb).localeCompare(String(ka));
    });
    return sorted;
  }, [rows, q, course, region, tier, status, sortKey, sortDir]);

  useEffect(() => { setPage(0); }, [q, course, region, tier, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const slice = filtered.slice(page * PAGE, (page + 1) * PAGE);

  const counts = useMemo(() => {
    const c = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    filtered.forEach(r => { c[RISK_FROM_ROW(r).band] += 1; });
    return c;
  }, [filtered]);

  const toggleSort = (k) => {
    if (k === sortKey) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'student_id' ? 'asc' : 'desc'); }
  };

  if (loading) return (
    <div style={{ padding: '3rem', display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--ink-muted)' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      Loading portfolio…
    </div>
  );

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>02</span>
            Borrower Portfolio
          </div>
          <h1>All borrowers — <em style={{ fontStyle: 'italic' }}>scored, ranked, filterable.</em></h1>
          <p style={{ marginTop: '0.55rem' }}>
            Every record the lender holds. Filter by course, region, tier, or placement status. Click any row for the full SHAP-explained student profile.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={load} disabled={refreshing}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Summary band */}
      <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
        <SummaryCard icon={Users}   label="Records shown" value={filtered.length.toLocaleString('en-IN')} sub={`of ${rows.length.toLocaleString('en-IN')} loaded`} accent="var(--navy)" />
        <SummaryCard icon={Layers}  label="LOW risk"   value={counts.LOW.toLocaleString('en-IN')}   sub="Placed ≤ 6m · CGPA ≥ 7"      accent="var(--risk-low)"    />
        <SummaryCard icon={Layers}  label="MEDIUM"     value={counts.MEDIUM.toLocaleString('en-IN')} sub="Placed within 12m"           accent="var(--risk-medium)" />
        <SummaryCard icon={Layers}  label="HIGH risk"  value={counts.HIGH.toLocaleString('en-IN')}   sub="Unplaced @ 12m — intervene" accent="var(--risk-high)"   />
      </div>

      {/* Filter rail */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.9rem 1.1rem' }}>
        <div style={{ display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="portfolio-search">
            <Search size={13} />
            <input
              placeholder="Search by ID, region, course…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>

          <FilterChip icon={Filter} label="Course" options={COURSES} value={course} onChange={setCourse} />
          <FilterChip icon={Filter} label="Region" options={REGIONS} value={region} onChange={setRegion} />
          <FilterChip icon={Filter} label="Tier"   options={TIERS}   value={tier}   onChange={setTier} />
          <FilterChip icon={Filter} label="Status" options={STATUS}  value={status} onChange={setStatus} />

          {(course !== 'ALL' || region !== 'ALL' || tier !== 'ALL' || status !== 'ALL' || q) && (
            <button
              onClick={() => { setQ(''); setCourse('ALL'); setRegion('ALL'); setTier('ALL'); setStatus('ALL'); }}
              style={{
                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase',
                color: 'var(--signal)', background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '0.32rem 0.4rem',
              }}
            >Clear all</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="portfolio-table">
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} onClick={() => toggleSort(col.key)} style={{ cursor: 'pointer', textAlign: col.numeric ? 'right' : 'left' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      {col.label}
                      {sortKey === col.key
                        ? (sortDir === 'asc' ? <ArrowUp size={11}/> : <ArrowDown size={11}/>)
                        : <ArrowUpDown size={11} style={{ opacity: 0.3 }} />}
                    </span>
                  </th>
                ))}
                <th style={{ width: 38, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {slice.length === 0 && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                  No borrowers match the current filters.
                </td></tr>
              )}
              {slice.map(r => {
                const risk = RISK_FROM_ROW(r);
                return (
                  <tr key={r.student_id}>
                    <td className="mono" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{r.student_id}</td>
                    <td>{r.course_type}</td>
                    <td><span className="portfolio-tier-pill">Tier {r.institute_tier}</span></td>
                    <td style={{ color: 'var(--ink-muted)' }}>{r.region}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{r.cgpa?.toFixed?.(1) ?? '—'}</td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--ink-muted)' }}>{r.internship_months}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      <IndianRupee size={9} style={{ verticalAlign: '-1px', color: 'var(--ink-faint)' }} />
                      {r.monthly_emi?.toLocaleString('en-IN')}
                    </td>
                    <td className="mono" style={{ textAlign: 'right' }}>
                      {r.actual_salary > 0
                        ? <><IndianRupee size={9} style={{ verticalAlign: '-1px', color: 'var(--ink-faint)' }}/>{r.actual_salary.toLocaleString('en-IN')}</>
                        : <span style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge badge-${risk.band.toLowerCase()}`} style={{ letterSpacing: '0.10em' }}>
                        {risk.band}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Link to={`/student/${r.student_id}`} className="portfolio-row-link" aria-label={`Open ${r.student_id}`}>
                        <ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="portfolio-pager">
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', letterSpacing: '0.06em' }}>
            Showing <span className="mono" style={{ color: 'var(--ink)' }}>{slice.length === 0 ? 0 : page * PAGE + 1}</span>–
            <span className="mono" style={{ color: 'var(--ink)' }}>{page * PAGE + slice.length}</span>
            {' '}of <span className="mono" style={{ color: 'var(--ink)' }}>{filtered.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.85rem' }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
              ← Prev
            </button>
            <div style={{
              padding: '0.45rem 0.85rem', border: '1px solid var(--rule)',
              fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-muted)',
              minWidth: 70, textAlign: 'center',
            }}>
              {page + 1} / {totalPages}
            </div>
            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.85rem' }} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="card card-sm" style={{ borderTop: `2px solid ${accent}` }}>
      <div className="card-title">
        <Icon size={12} /> {label}
      </div>
      <div className="stat-value" style={{ color: accent }}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function FilterChip({ icon: Icon, label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      <Icon size={12} style={{ color: 'var(--ink-faint)' }} />
      <span style={{
        fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: 'var(--ink-muted)',
      }}>{label}</span>
      <select
        className="portfolio-filter-select"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
