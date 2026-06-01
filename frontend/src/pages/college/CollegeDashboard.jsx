import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Building2, Users, TrendingUp, Briefcase, IndianRupee, Activity, ArrowRight,
  ShieldAlert, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE } from '../../App';

const fmtINR = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${v.toLocaleString('en-IN')}`;
};
const pct = (x) => `${Math.round((Number(x) || 0) * 100)}%`;

export default function CollegeDashboard() {
  const { user } = useAuth();
  const institute = user?.institute || 'Demo Institute';
  const [data, setData] = useState(null);
  const [borrowers, setBorrowers] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const inst = encodeURIComponent(institute);
    Promise.all([
      axios.get(`${API_BASE}/api/v1/college/${inst}/analytics`).then((r) => r.data).catch(() => null),
      axios.get(`${API_BASE}/api/v1/college/${inst}/borrowers`).then((r) => r.data).catch(() => null),
    ]).then(([analytics, b]) => {
      setData(analytics);
      setBorrowers(b);
    }).finally(() => setLoading(false));
  }, [institute]);

  if (loading) {
    return <div className="card" style={{ padding: '2rem', color: 'var(--ink-muted)' }}>
      <Activity size={14} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />Loading analytics…
    </div>;
  }

  const totals = data?.totals || {};
  const hasData = data?.found && (totals.programs > 0 || totals.students_tracked > 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--ink)', margin: 0 }}>
            <Building2 size={22} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--signal)' }} />
            {institute}
          </h1>
          <div style={{ color: 'var(--ink-faint)', fontSize: '0.82rem', marginTop: 4 }}>
            Placement Analytics
            {data?.institute_tier ? ` · Tier ${data.institute_tier}` : ''}
            {data?.accreditation ? ` · ${data.accreditation}` : ''}
          </div>
        </div>
        <Link to="/college/data" className="btn btn-primary" style={{ textDecoration: 'none' }}>
          Manage Data <ArrowRight size={14} />
        </Link>
      </div>

      {!hasData ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <Building2 size={32} style={{ color: 'var(--ink-faint)', marginBottom: 12 }} />
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>No placement data yet</div>
          <div style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', marginBottom: 18 }}>
            Add your programs, recruiters and student placement status to see analytics here.
          </div>
          <Link to="/college/data" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Add placement data <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <Kpi icon={Users} label="Total Students" value={totals.total_students} />
            <Kpi icon={TrendingUp} label="Placed" value={totals.total_placed} accent />
            <Kpi icon={Activity} label="Placement Rate" value={pct(totals.overall_placement_rate)} accent />
            <Kpi icon={Briefcase} label="Recruiters" value={totals.recruiters} />
            <Kpi icon={Briefcase} label="Total Offers" value={totals.total_offers} />
            <Kpi icon={IndianRupee} label="Median Salary" value={fmtINR(data?.salary_summary?.median_of_medians)} />
          </div>

          {/* Branch-wise */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-title"><TrendingUp size={14} /> Branch-wise Placement</div>
            <Table
              head={['Program', 'Placed / Total', '3m', '6m', '12m', 'Median', 'Highest']}
              rows={(data.branch_wise || []).map((b) => [
                b.program,
                `${b.placed} / ${b.total_students}`,
                pct(b.rate_3m), pct(b.rate_6m), pct(b.rate_12m),
                fmtINR(b.median_salary), fmtINR(b.highest_salary),
              ])}
              empty="No programs added yet."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {/* Recruiters */}
            <div className="card">
              <div className="card-title"><Briefcase size={14} /> Top Recruiters</div>
              <Table
                head={['Recruiter', 'Industry', 'Openings', 'Selected']}
                rows={(data.recruiter_trends || []).map((r) => [r.name, r.industry || '—', r.openings, r.selected])}
                empty="No recruiters added yet."
              />
            </div>

            {/* Status buckets */}
            <div className="card">
              <div className="card-title"><Activity size={14} /> Student Placement Status</div>
              {(() => {
                const b = data.placement_status_buckets || {};
                const total = (b.placed || 0) + (b.in_progress || 0) + (b.not_placed || 0);
                const bars = [
                  { label: 'Placed', n: b.placed || 0, color: 'var(--risk-low)' },
                  { label: 'In progress', n: b.in_progress || 0, color: 'var(--risk-medium)' },
                  { label: 'Not placed', n: b.not_placed || 0, color: 'var(--risk-high)' },
                ];
                if (!total) return <div style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>No student status added yet.</div>;
                return bars.map((x) => (
                  <div key={x.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--ink-muted)', marginBottom: 3 }}>
                      <span>{x.label}</span><span>{x.n}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--paper-deep)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${total ? (x.n / total) * 100 : 0}%`, height: '100%', background: x.color }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </>
      )}

      {/* Lender-scored borrowers tagged to this institute — the SAME risk bands
          the lender sees. Populated as you sync student placement status with
          real STU-2026 IDs (or as the lender onboards borrowers under this name). */}
      <BorrowersSection borrowers={borrowers} />
    </div>
  );
}

const bandColor = (b) => b === 'LOW' ? 'var(--risk-low)' : b === 'HIGH' ? 'var(--risk-high)' : 'var(--risk-medium)';

function BorrowersSection({ borrowers }) {
  const list = borrowers?.borrowers || [];
  const counts = borrowers?.risk_counts || { LOW: 0, MEDIUM: 0, HIGH: 0 };
  return (
    <div className="card" style={{ marginTop: '1.25rem' }}>
      <div className="card-title"><ShieldAlert size={14} /> My borrowers · lender risk view</div>
      {list.length === 0 ? (
        <div style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', padding: '0.75rem 0' }}>
          No borrowers linked to this institute yet. In <strong>Manage Data → Student Status</strong>,
          enter real <span className="mono">STU-2026-#####</span> IDs and mark them placed/in-progress —
          they'll appear here with the lender's live engine risk band.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', margin: '0.4rem 0 1rem' }}>
            {['HIGH', 'MEDIUM', 'LOW'].map((b) => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: bandColor(b), display: 'inline-block' }} />
                <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{b}</span>
                <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)' }}>{counts[b] || 0}</strong>
              </div>
            ))}
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', alignSelf: 'center' }}>
              {borrowers?.total || list.length} total linked
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr>{['Student ID', 'Course · Tier', 'CGPA', 'Backlogs', '6m', 'Risk'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--ink-faint)', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--card-edge)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {list.slice(0, 50).map((s) => (
                  <tr key={s.student_id}>
                    <td className="mono" style={{ padding: '7px 10px', fontSize: '0.78rem', color: 'var(--navy)', borderBottom: '1px solid var(--card-edge)' }}>{s.student_id}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--ink)', borderBottom: '1px solid var(--card-edge)' }}>{s.course_type} · Tier {s.institute_tier}</td>
                    <td style={{ padding: '7px 10px', color: 'var(--ink-muted)', borderBottom: '1px solid var(--card-edge)' }}>{Number(s.cgpa).toFixed(1)}</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--card-edge)', color: s.active_backlogs > 0 ? 'var(--risk-high)' : 'var(--ink-muted)', fontWeight: s.active_backlogs > 0 ? 700 : 400 }}>
                      {s.active_backlogs > 0 ? <><AlertTriangle size={11} style={{ verticalAlign: '-1px' }} /> {s.active_backlogs}</> : '0'}
                    </td>
                    <td className="mono" style={{ padding: '7px 10px', color: 'var(--ink)', borderBottom: '1px solid var(--card-edge)' }}>{Math.round((s.placement_6m || 0) * 100)}%</td>
                    <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--card-edge)' }}>
                      <span className={`badge badge-${(s.risk_band || 'medium').toLowerCase()}`}>{s.risk_band || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <Icon size={16} style={{ color: accent ? 'var(--signal)' : 'var(--ink-faint)' }} />
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--ink)', marginTop: 6, lineHeight: 1 }}>
        {value ?? 0}
      </div>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-faint)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Table({ head, rows, empty }) {
  if (!rows || rows.length === 0) {
    return <div style={{ color: 'var(--ink-muted)', fontSize: '0.85rem' }}>{empty}</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
        <thead>
          <tr>{head.map((h) => (
            <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--ink-faint)', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid var(--card-edge)' }}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => (
              <td key={j} style={{ padding: '7px 10px', color: j === 0 ? 'var(--ink)' : 'var(--ink-muted)', fontWeight: j === 0 ? 600 : 400, borderBottom: '1px solid var(--card-edge)' }}>{c}</td>
            ))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
