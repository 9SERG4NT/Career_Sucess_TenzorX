import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw, Filter, MapPin, Briefcase, IndianRupee } from 'lucide-react';
import { API_BASE } from '../App';

// ─── City coordinates ─────────────────────────────────────────
const CITY_COORDS = {
  'Mumbai':     { lat: 19.0760, lng: 72.8777, state: 'Maharashtra' },
  'Bengaluru':  { lat: 12.9716, lng: 77.5946, state: 'Karnataka' },
  'Delhi NCR':  { lat: 28.6139, lng: 77.2090, state: 'Delhi' },
  'Pune':       { lat: 18.5204, lng: 73.8567, state: 'Maharashtra' },
  'Hyderabad':  { lat: 17.3850, lng: 78.4867, state: 'Telangana' },
  'Chennai':    { lat: 13.0827, lng: 80.2707, state: 'Tamil Nadu' },
};

const FIELD_INK = {
  Engineering: '#1B2C5E',
  MBA:         '#C2410C',
  Nursing:     '#2F6E45',
};

// Demand → editorial palette
const demandPalette = (score) => {
  if (score >= 75) return { hex: '#2F6E45', label: 'HIGH',   bg: 'rgba(47,110,69,0.08)' };
  if (score >= 55) return { hex: '#A5751F', label: 'MEDIUM', bg: 'rgba(165,117,31,0.09)' };
  return                  { hex: '#A82828', label: 'LOW',    bg: 'rgba(168,40,40,0.08)' };
};

function TrendBadge({ trend }) {
  const isUp = trend?.startsWith('+');
  const isDown = trend?.startsWith('-');
  const color = isUp ? '#2F6E45' : isDown ? '#A82828' : '#5E564B';
  const bg = isUp ? 'rgba(47,110,69,0.10)' : isDown ? 'rgba(168,40,40,0.10)' : 'var(--paper-deep)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.7rem', fontWeight: 500,
      padding: '2px 7px', borderRadius: '2px',
      background: bg, color, border: `1px solid ${color}40`,
      letterSpacing: '-0.01em',
    }}>
      {isUp ? <TrendingUp size={10} /> : isDown ? <TrendingDown size={10} /> : <Minus size={10} />}
      {trend}
    </span>
  );
}

// ─── Map controller — fits India bounds on mount ──────────────
function FitIndia() {
  const map = useMap();
  useEffect(() => {
    // India bounds (south-west to north-east)
    map.fitBounds([[6.4, 68.0], [35.5, 97.5]], { padding: [20, 20] });
  }, [map]);
  return null;
}

// ─── Real density heatmap layer ───────────────────────────────
// Renders an actual gradient density blob (leaflet.heat) instead of plain
// CircleMarkers. The `intensity` scales with each hub's avg demand score,
// so high-demand hubs paint a hotter / wider plume. Editorial palette:
//   low  → low-stop green     (#2F6E45)
//   mid  → ochre              (#A5751F)
//   high → deep oxide red     (#A82828)
function HeatLayer({ points, gradient, radius = 75, blur = 60 }) {
  const map = useMap();
  const layerRef = useRef(null);

  useEffect(() => {
    if (!points || points.length === 0) return;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    layerRef.current = L.heatLayer(points, {
      radius,
      blur,
      maxZoom: 9,
      minOpacity: 0.35,
      gradient,
    }).addTo(map);
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, points, gradient, radius, blur]);
  return null;
}

// ─── Rich popup content for a city ────────────────────────────
function CityPopupContent({ city, fields }) {
  const meta = CITY_COORDS[city];
  const avgDemand = Math.round(fields.reduce((s, f) => s + f.demand_score, 0) / (fields.length || 1));
  const palette = demandPalette(avgDemand);
  const avgSalary = Math.round(fields.reduce((s, f) => s + (f.avg_fresher_salary_inr || 0), 0) / (fields.length || 1));

  return (
    <div style={{ minWidth: '300px', maxWidth: '340px', fontFamily: 'var(--font-sans)' }}>
      {/* Eyebrow */}
      <div style={{
        fontFamily: 'var(--font-sans)',
        fontSize: '0.6rem', fontWeight: 700,
        letterSpacing: '0.22em', textTransform: 'uppercase',
        color: 'var(--signal)', marginBottom: '0.45rem',
      }}>
        Hiring Hub · {meta?.state}
      </div>

      {/* City + headline number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.85rem' }}>
        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 400, fontSize: '1.55rem',
          fontVariationSettings: '"opsz" 72',
          letterSpacing: '-0.025em',
          color: 'var(--ink)',
          margin: 0, lineHeight: 1.05,
        }}>{city}</h3>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.95rem', fontWeight: 400,
          fontVariationSettings: '"opsz" 144',
          letterSpacing: '-0.04em',
          color: palette.hex,
          fontFeatureSettings: '"tnum"',
          lineHeight: 1,
        }}>
          {avgDemand}
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginLeft: '2px', fontFamily: 'var(--font-sans)' }}>/100</span>
        </span>
      </div>

      {/* Aggregate row */}
      <div style={{
        display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--rule-strong)',
        marginBottom: '0.75rem',
      }}>
        <span className={`badge badge-${palette.label === 'HIGH' ? 'low' : palette.label === 'MEDIUM' ? 'medium' : 'high'}`}>
          {palette.label === 'HIGH' ? 'High demand' : palette.label === 'MEDIUM' ? 'Medium demand' : 'Low demand'}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-mono)', fontSize: '0.78rem',
          color: 'var(--ink-soft)',
        }}>
          <IndianRupee size={11} />
          {avgSalary?.toLocaleString('en-IN')}
          <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-sans)', fontSize: '0.68rem', marginLeft: '2px' }}>avg fresher</span>
        </span>
      </div>

      {/* Per-field breakdown */}
      <div style={{
        fontSize: '0.6rem', fontWeight: 700,
        letterSpacing: '0.22em', textTransform: 'uppercase',
        color: 'var(--ink-faint)', marginBottom: '0.55rem',
      }}>
        Field-level demand
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {fields.map(f => {
          const fp = demandPalette(f.demand_score);
          return (
            <div key={f.field} style={{
              display: 'grid',
              gridTemplateColumns: '16px 1fr auto auto',
              gap: '0.6rem',
              alignItems: 'center',
            }}>
              <span style={{
                width: '4px', height: '18px',
                background: FIELD_INK[f.field] || 'var(--ink)',
                display: 'inline-block',
              }} />
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: '0.85rem', fontWeight: 600,
                  color: 'var(--ink)', letterSpacing: '-0.005em',
                }}>{f.field}</div>
                {f.top_roles?.length > 0 && (
                  <div style={{
                    fontSize: '0.68rem',
                    color: 'var(--ink-muted)',
                    marginTop: '1px',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }} title={f.top_roles.join(', ')}>
                    {f.top_roles.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.05rem', fontWeight: 400,
                fontVariationSettings: '"opsz" 48',
                color: fp.hex,
                fontFeatureSettings: '"tnum"',
                letterSpacing: '-0.02em',
              }}>{f.demand_score}</span>
              <TrendBadge trend={f.trend} />
            </div>
          );
        })}
      </div>

      {/* Salary detail per field */}
      <div style={{
        marginTop: '0.85rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid var(--rule)',
        display: 'flex', flexDirection: 'column', gap: '0.3rem',
      }}>
        <div style={{
          fontSize: '0.6rem', fontWeight: 700,
          letterSpacing: '0.22em', textTransform: 'uppercase',
          color: 'var(--ink-faint)', marginBottom: '0.3rem',
        }}>
          Avg fresher salary (₹/yr)
        </div>
        {fields.map(f => (
          <div key={f.field} style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: 'var(--ink-soft)',
          }}>
            <span style={{ color: 'var(--ink-muted)' }}>{f.field}</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontFeatureSettings: '"tnum"' }}>
              ₹{f.avg_fresher_salary_inr?.toLocaleString('en-IN') || '—'}
            </span>
          </div>
        ))}
      </div>

      {/* Source line */}
      <div style={{
        marginTop: '0.85rem',
        paddingTop: '0.55rem',
        borderTop: '1px solid var(--rule)',
        fontSize: '0.6rem',
        color: 'var(--ink-faint)',
        letterSpacing: '0.04em',
        fontStyle: 'italic',
      }}>
        Source — World Bank macro + Foundit/Naukri job-posting volumes (2025).
      </div>
    </div>
  );
}

// ─── Main Heatmap ───────────────────────────────────────────
function Heatmap() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterField, setFilterField] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);
  const popupRefs = useRef({});

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const params = {};
      if (filterField !== 'ALL') params.field = filterField;
      const res = await axios.get(`${API_BASE}/api/v1/heatmap/demand`, { params });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, [filterField]);

  // Group grid cells by region
  const byCity = useMemo(() => {
    const map = {};
    (data?.grid || []).forEach(cell => {
      if (!map[cell.region]) map[cell.region] = [];
      map[cell.region].push(cell);
    });
    return map;
  }, [data]);

  // Density-layer points: [lat, lng, intensity 0–1]. Avg demand per hub →
  // intensity. To get a wider density "footprint" without inventing fake
  // coordinates, drop one extra weighted point per per-field cell so highly
  // diversified hubs (Engineering + MBA + Nursing all hot) glow more.
  const heatPoints = useMemo(() => {
    const pts = [];
    Object.entries(byCity).forEach(([city, cells]) => {
      const meta = CITY_COORDS[city];
      if (!meta) return;
      const avg = cells.reduce((s, c) => s + c.demand_score, 0) / cells.length;
      pts.push([meta.lat, meta.lng, Math.max(0.15, avg / 100)]);
      cells.forEach((c, i) => {
        // Spread companions in a small ring for a bigger plume
        const angle = (i / cells.length) * Math.PI * 2;
        const r = 0.45;  // ~50 km offset
        pts.push([
          meta.lat + Math.sin(angle) * r,
          meta.lng + Math.cos(angle) * r,
          Math.max(0.10, c.demand_score / 100 * 0.75),
        ]);
      });
    });
    return pts;
  }, [byCity]);

  const heatGradient = {
    0.20: '#2F6E45',
    0.50: '#A5751F',
    0.80: '#C2410C',
    1.00: '#A82828',
  };

  if (loading) return (
    <div style={{ padding: '3rem', display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--ink-muted)' }}>
      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
      Loading employability map…
    </div>
  );

  const fields = ['ALL', 'Engineering', 'MBA', 'Nursing'];

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '320px' }}>
          <div className="eyebrow" style={{ marginBottom: '0.85rem', color: 'var(--signal)' }}>
            <span style={{ marginRight: '0.5em' }}>03</span>
            Geographic Demand
          </div>
          <h1>Dynamic Employability Map — India</h1>
          <p style={{ marginTop: '0.55rem' }}>
            Hover any hub for the full hiring spec: field-level demand, top roles, avg fresher salary, momentum trend.{' '}
            <span className="mono" style={{ color: 'var(--ink)' }}>
              {data?.grid?.length || 0} cells
            </span>
            {' '}across <span className="mono" style={{ color: 'var(--ink)' }}>{Object.keys(byCity).length}</span> hubs · last updated {data?.last_updated}.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchData} disabled={refreshing}>
          <RefreshCw size={13} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '0.9rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
            <Filter size={13} style={{ color: 'var(--ink-muted)' }} />
            <span style={{
              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.18em',
              textTransform: 'uppercase', color: 'var(--ink-muted)',
            }}>Field</span>
            {fields.map(f => (
              <button key={f} onClick={() => setFilterField(f)}
                style={{
                  padding: '0.32rem 0.75rem',
                  fontSize: '0.7rem', fontWeight: 700,
                  letterSpacing: '0.10em', textTransform: 'uppercase',
                  cursor: 'pointer',
                  border: filterField === f ? '1px solid var(--ink)' : '1px solid var(--card-edge)',
                  background: filterField === f ? 'var(--ink)' : 'transparent',
                  color: filterField === f ? 'var(--card-raised)' : 'var(--ink-muted)',
                  borderRadius: '2px',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.2s',
                }}>
                {f}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '1.1rem', alignItems: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--ink-muted)', letterSpacing: '0.04em' }}>
            <LegendDot color="#2F6E45" label="≥ 75 High demand" />
            <LegendDot color="#A5751F" label="55–74 Medium" />
            <LegendDot color="#A82828" label="< 55 Low" />
          </div>
        </div>
      </div>

      {/* Map card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem', position: 'relative' }}>
        {/* Card eyebrow positioned on map */}
        <div style={{
          position: 'absolute',
          top: '14px', left: '14px',
          zIndex: 500,
          background: 'var(--card-raised)',
          border: '1px solid var(--card-edge-strong)',
          borderLeft: '3px solid var(--signal)',
          padding: '0.5rem 0.85rem',
          borderRadius: '2px',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.62rem',
          fontWeight: 700,
          letterSpacing: '0.20em',
          textTransform: 'uppercase',
          color: 'var(--ink)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <MapPin size={11} style={{ display: 'inline-block', marginRight: '6px', color: 'var(--signal)', verticalAlign: '-1px' }} />
          {Object.keys(byCity).length} hiring hubs
        </div>

        <div style={{ height: '560px', width: '100%', position: 'relative', background: '#F2EFE8' }}>
          <MapContainer
            center={[22.0, 79.0]}
            zoom={5}
            minZoom={4}
            maxZoom={9}
            style={{ height: '100%', width: '100%', background: '#F2EFE8' }}
            zoomControl
            scrollWheelZoom
            attributionControl
          >
            <FitIndia />
            {/* Free CartoDB Positron — minimal grayscale, paper-friendly, no API key */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />

            {/* Real density gradient layer — leaflet.heat */}
            <HeatLayer points={heatPoints} gradient={heatGradient} radius={85} blur={70} />

            {/* Compact click-target markers (small, on top of the heat plume) */}
            {Object.entries(byCity).map(([city, cells]) => {
              const meta = CITY_COORDS[city];
              if (!meta) return null;
              const avgDemand = Math.round(cells.reduce((s, c) => s + c.demand_score, 0) / cells.length);
              const palette = demandPalette(avgDemand);
              return (
                <CircleMarker
                  key={city}
                  center={[meta.lat, meta.lng]}
                  radius={6}
                  pathOptions={{
                    color: 'var(--ink)',
                    fillColor: palette.hex,
                    fillOpacity: 1,
                    weight: 2,
                    opacity: 1,
                  }}
                  eventHandlers={{
                    mouseover: (e) => e.target.openPopup(),
                  }}
                >
                  <LeafletTooltip
                    direction="top"
                    offset={[0, -10]}
                    opacity={1}
                    permanent={false}
                    className="paper-tooltip-label"
                  >
                    <strong>{city}</strong> — {avgDemand}/100
                  </LeafletTooltip>
                  <Popup
                    maxWidth={360}
                    minWidth={300}
                    closeButton={false}
                    className="paper-popup"
                    autoPan={false}
                    ref={(el) => { popupRefs.current[city] = el; }}
                  >
                    <CityPopupContent city={city} fields={cells} />
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Gradient legend bar (real heatmap has a real legend) */}
          <div className="heat-legend">
            <div className="heat-legend-label">Hiring Demand</div>
            <div className="heat-legend-bar" />
            <div className="heat-legend-ticks">
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per-city summary band — for accessibility / scanability */}
      <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
        {Object.entries(byCity).map(([city, cells]) => {
          const avg = Math.round(cells.reduce((s, c) => s + c.demand_score, 0) / cells.length);
          const palette = demandPalette(avg);
          return (
            <div key={city} className="card" style={{ borderLeft: `3px solid ${palette.hex}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
                <div className="card-title" style={{ margin: 0 }}>
                  <MapPin size={12} /> {city}
                </div>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.55rem', fontWeight: 400,
                  fontVariationSettings: '"opsz" 96',
                  letterSpacing: '-0.03em',
                  color: palette.hex,
                  fontFeatureSettings: '"tnum"',
                }}>
                  {avg}
                  <span style={{ fontSize: '0.62rem', color: 'var(--ink-faint)', fontFamily: 'var(--font-sans)', marginLeft: '2px' }}>/100</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {cells.map(c => (
                  <div key={c.field} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontSize: '0.78rem',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--ink-soft)' }}>
                      <span style={{ width: '2px', height: '12px', background: FIELD_INK[c.field] }} />
                      {c.field}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink)', fontFeatureSettings: '"tnum"' }}>{c.demand_score}</span>
                      <TrendBadge trend={c.trend} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, border: '1px solid var(--ink)', opacity: 0.85 }} />
      {label}
    </span>
  );
}

export default Heatmap;
