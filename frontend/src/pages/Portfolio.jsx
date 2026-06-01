import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Search, Filter, RefreshCw, ArrowUpDown, ArrowDown, ArrowUp,
  Users, ChevronRight, IndianRupee, Layers,
} from 'lucide-react';
import { API_BASE } from '../App';

const COURSES = ['ALL', 'Engineering', 'MBA', 'Nursing'];
const REGIONS = ['ALL', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Chennai'];
const TIERS   = ['ALL', 'A', 'B', 'C', 'D'];
const STATUS  = ['ALL', 'Placed (6m)', 'Placed (12m)', 'Unplaced'];
const PAGE    = 25;

const STATUS_API = {
  'Placed (6m)':  'placed_6m',
  'Placed (12m)': 'placed_12m',
  'Unplaced':     'unplaced',
};

const RISK_BAND_COLOR = (b) =>
  b === 'LOW' ? 'var(--risk-low)' : b === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';

const COLUMNS = [
  { key: 'student_id',        label: 'Student ID',  numeric: false },
  { key: 'course_type',       label: 'Course',      numeric: false },
  { key: 'institute_tier',    label: 'Tier',        numeric: false },
  { key: 'region',            label: 'Region',      numeric: false },
  { key: 'cgpa',              label: 'CGPA',        numeric: true  },
  { key: 'internship_months', label: 'Intern (mo)', numeric: true  },
  { key: 'monthly_emi',       label: 'EMI ₹/mo',    numeric: true  },
  { key: 'actual_salary',     label: 'CTC ₹/yr',    numeric: true  },
  { key: '_risk',             label: 'Risk',        numeric: false },
];

export default function Portfolio() {
  // Server state
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [riskCounts, setRiskCounts] = useState({ LOW: 0, MEDIUM: 0, HIGH: 0 });
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [q, setQ]             = useState('');
  const [course, setCourse]   = useState('ALL');
  const [region, setRegion]   = useState('ALL');
  const [tier, setTier]       = useState('ALL');
  const [status, setStatus]   = useState('ALL');

  // Client-side sort (sorts the current page only — acceptable for paginated tables)
  const [sortKey, setSortKey] = useState('_risk');
  const [sortDir, setSortDir] = useState('asc');  // asc = HIGH first for risk

  // Pagination
  const [page, setPage] = useState(0);

  // Debounce search
  const qTimer = useRef(null);
  const [qDebounced, setQDebounced] = useState('');
  const onQChange = (v) => {
    setQ(v);
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setQDebounced(v), 300);
  };

  const fetch = useCallback(async (opts = {}) => {
    const isRefresh = opts.refresh;
    if (isRefresh) setRefreshing(true); else if (!loading) setRefreshing(true);
    try {
      const params = {
        limit: PAGE,
        offset: page * PAGE,
        sort: 'risk',          // backend always delivers HIGH-first within the page
        q: qDebounced || undefined,
        course: course !== 'ALL' ? course : undefined,
        region: region !== 'ALL' ? region : undefined,
        tier:   tier   !== 'ALL' ? tier   : undefined,
        status: STATUS_API[status] || undefined,
      };
      const r = await axios.get(`${API_BASE}/api/v1/students`, { params });
      const data = r.data;
      // Handle both old (array) and new ({students, total}) response shapes.
      if (Array.isArray(data)) {
        setRows(data);
        setTotal(data.length);
        setRiskCounts({ LOW: 0, MEDIUM: 0, HIGH: 0 });
      } else {
        setRows(data.students || []);
        setTotal(data.total || 0);
        setRiskCounts(data.risk_counts || { LOW: 0, MEDIUM: 0, HIGH: 0 });
      }
    } catch {
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, qDebounced, course, region, tier, status]); // eslint-disable-line

  useEffect(() => { fetch(); }, [fetch]);

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0); }, [qDebounced, course, region, tier, status]);

  // Client-side sort within the current page
  const sorted = [...rows].sort((a, b) => {
    let ka = sortKey === '_risk' ? { HIGH: 0, MEDIUM: 1, LOW: 2 }[a.risk_band ?? 'MEDIUM'] ?? 1 : a[sortKey];
    let kb = sortKey === '_risk' ? { HIGH: 0, MEDIUM: 1, LOW: 2 }[b.risk_band ?? 'MEDIUM'] ?? 1 : b[sortKey];
    if (ka == null) return 1;
    if (kb == null) return -1;
    if (typeof ka === 'number' && typeof kb === 'number')
      return sortDir === 'asc' ? ka - kb : kb - ka;
    return sortDir === 'asc'
      ? String(ka).localeCompare(String(kb))
      : String(kb).localeCompare(String(ka));
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  const toggleSort = (k) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir(k === 'student_id' ? 'asc' : k === '_risk' ? 'asc' : 'desc'); }
  };

  const clearAll = () => { setQ(''); setQDebounced(''); setCourse('ALL'); setRegion('ALL'); setTier('ALL'); setStatus('ALL'); };
  const hasFilters = course !== 'ALL' || region !== 'ALL' || tier !== 'ALL' || status !== 'ALL' || q;

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
            <span style={{ marginRight: '0.5em' }}>02</span>Borrower Portfolio
          </div>
          <h1>All borrowers — <em style={{ fontStyle: 'italic' }}>scored, ranked, filterable.</em></h1>
          <p style={{ marginTop: '0.55rem' }}>
            Every record the lender holds. Filter by course, region, tier, or placement status. Click any row for the full SHAP-explained student profile.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => fetch({ refresh: true })} disabled={refreshing}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Summary band */}
      <div className="grid-4" style={{ marginBottom: '1.25rem' }}>
        <SummaryCard icon={Users}  label="Records shown"  value={total.toLocaleString('en-IN')}              sub="matching filters"          accent="var(--navy)"       />
        <SummaryCard icon={Layers} label="LOW risk"        value={riskCounts.LOW.toLocaleString('en-IN')}     sub="Model 6m ≥ 70%"            accent="var(--risk-low)"   />
        <SummaryCard icon={Layers} label="MEDIUM"          value={riskCounts.MEDIUM.toLocaleString('en-IN')}  sub="Model 6m 45–70%"           accent="var(--risk-medium)"/>
        <SummaryCard icon={Layers} label="HIGH risk"       value={riskCounts.HIGH.toLocaleString('en-IN')}    sub="Model 6m < 45% / override" accent="var(--risk-high)"  />
      </div>

      {/* Filter rail */}
      <div className="card" style={{ marginBottom: '1rem', padding: '0.9rem 1.1rem' }}>
        <div style={{ display: 'flex', gap: '1.1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="portfolio-search">
            <Search size={13} />
            <input placeholder="Search by ID, region, course…" value={q} onChange={e => onQChange(e.target.value)} />
          </div>
          <FilterChip icon={Filter} label="Course" options={COURSES} value={course} onChange={v => { setCourse(v); setPage(0); }} />
          <FilterChip icon={Filter} label="Region" options={REGIONS} value={region} onChange={v => { setRegion(v); setPage(0); }} />
          <FilterChip icon={Filter} label="Tier"   options={TIERS}   value={tier}   onChange={v => { setTier(v);   setPage(0); }} />
          <FilterChip icon={Filter} label="Status" options={STATUS}  value={status} onChange={v => { setStatus(v); setPage(0); }} />
          {hasFilters && (
            <button onClick={clearAll} style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--signal)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.32rem 0.4rem' }}>
              Clear all
            </button>
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
              {sorted.length === 0 && !refreshing && (
                <tr><td colSpan={COLUMNS.length + 1} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                  No borrowers match the current filters.
                </td></tr>
              )}
              {sorted.map(r => {
                const band = r.risk_band || 'MEDIUM';
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
                      <span className={`badge badge-${band.toLowerCase()}`} style={{ letterSpacing: '0.10em', color: RISK_BAND_COLOR(band) }}>
                        {band}
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
            Showing <span className="mono" style={{ color: 'var(--ink)' }}>{total === 0 ? 0 : page * PAGE + 1}</span>–
            <span className="mono" style={{ color: 'var(--ink)' }}>{Math.min((page + 1) * PAGE, total)}</span>
            {' '}of <span className="mono" style={{ color: 'var(--ink)' }}>{total.toLocaleString('en-IN')}</span>
            {hasFilters && <span style={{ marginLeft: '0.35em', fontStyle: 'italic' }}>(filtered)</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.85rem' }} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || refreshing}>
              ← Prev
            </button>
            <div style={{ padding: '0.45rem 0.85rem', border: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--ink-muted)', minWidth: 70, textAlign: 'center' }}>
              {page + 1} / {totalPages}
            </div>
            <button className="btn btn-ghost" style={{ padding: '0.4rem 0.85rem' }} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1 || refreshing}>
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
      <div className="card-title"><Icon size={12} /> {label}</div>
      <div className="stat-value" style={{ color: accent }}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function FilterChip({ icon: Icon, label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
      <Icon size={12} style={{ color: 'var(--ink-faint)' }} />
      <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>{label}</span>
      <select className="portfolio-filter-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
