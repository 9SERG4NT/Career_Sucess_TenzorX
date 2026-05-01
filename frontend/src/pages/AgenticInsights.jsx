import React, { useState } from 'react';
import { Target, MessageSquare, TrendingDown, Map, Shield, Activity, Brain } from 'lucide-react';
import axios from 'axios';
import { API_BASE } from '../App';

function AgentCard({ title, desc, icon: Icon }) {
  return (
    <div className="agent-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color="var(--accent-purple)" />
        </div>
        <span className="badge badge-low" style={{ fontSize: '0.7rem' }}>Active</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>{title}</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', minHeight: '35px' }}>{desc}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', fontSize: '0.72rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Groq · llama-3.1-8b</span>
        <span style={{ color: 'var(--text-muted)' }}>2 mins ago</span>
      </div>
    </div>
  );
}

function AgenticInsights() {
  const [studentId, setStudentId] = useState('STU-2026-00001');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState('');

  const runDemo = async () => {
    if (!studentId) return;
    setRunning(true);
    setResult(null);
    setStep('Step 1: Fetching student profile...');

    try {
      // 1. Fetch profile
      const profileRes = await axios.get(`${API_BASE}/api/v1/student/${studentId}`);
      if (!profileRes.data || !profileRes.data.profile) throw new Error('Student not found');
      
      const profile = profileRes.data.profile;
      
      // Map for POST request
      const reqBody = {
        student_id: profile.student_id,
        course_type: profile.course_type || 'Engineering',
        institute_tier: profile.institute_tier || 'A',
        region: profile.region || 'Bengaluru',
        cgpa: profile.cgpa || 7.5,
        internship_months: profile.internship_months || 3,
        employer_tier: profile.employer_tier || 'Startup',
        iqi: profile.iqi || 0.5,
        behavioral_activity_score: profile.behavioral_activity_score || 65,
        field_demand_score: profile.field_demand_score || 80,
        macro_climate_index: profile.macro_climate_index || 0.7,
        monthly_emi: profile.monthly_emi || 15000
      };

      setStep('Step 2: ML Models + Orchestrating Agents (NBA & Explainability)...');

      // 2. Fetch Agentic Insights
      const scoreRes = await axios.post(`${API_BASE}/api/v1/score/student`, reqBody);
      setResult(scoreRes.data);
      setStep('Complete!');
    } catch (e) {
      setResult({ error: e.response?.data?.detail || e.message || 'Simulation failed' });
      setStep('Failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Brain size={24} color="var(--accent-purple)" /> Agentic AI Command Center
        </h1>
        <p>Real-time view of AI agent activity powering PlacementIQ's risk intelligence</p>
      </div>

      {/* Agents Grid */}
      <div className="grid-5" style={{ marginBottom: '2.5rem' }}>
        <AgentCard title="NBA Agent" desc="Recommends cost-aware, ROI-ranked interventions" icon={Target} />
        <AgentCard title="Explainability Agent" desc="Generates human-readable risk narratives from SHAP" icon={MessageSquare} />
        <AgentCard title="Market Intel Agent" desc="Detects hiring shocks and sector disruptions" icon={TrendingDown} />
        <AgentCard title="Career Path Agent" desc="Finds demand-aware career pivots for at-risk students" icon={Map} />
        <AgentCard title="Offer Survival Agent" desc="Scores P(offer not revoked) using employer signals" icon={Shield} />
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Live Demo */}
        <div className="card">
          <div className="card-title" style={{ color: 'var(--accent-purple)' }}><Activity size={15} /> Live Agent Demo</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Trigger a full pipeline execution for a specific student. This orchestrates the ML models first, then runs the agents to enrich the output.
          </p>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            <input 
              type="text" 
              className="select-input" 
              style={{ flex: 1, minHeight: 'auto', padding: '0.5rem 0.85rem' }} 
              value={studentId} 
              onChange={e => setStudentId(e.target.value)} 
              placeholder="e.g. STU-2026-00001"
            />
            <button className="btn btn-primary" onClick={runDemo} disabled={running} style={{ whiteSpace: 'nowrap', background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)' }}>
              <Brain size={14} /> {running ? 'Running Pipeline...' : 'Run Full Agentic Pipeline'}
            </button>
          </div>

          {step && (
            <div className={running ? "agentic-thinking" : "agentic-narrative"} style={{ marginBottom: '1rem' }}>
              {running && <Activity size={16} className="pulse-dot" />} {step}
            </div>
          )}

          {result && (
            <div className="json-viewer">
              <pre style={{ margin: 0 }}>{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>

        <div>
          {/* Architecture Diagram */}
          <div className="card" style={{ marginBottom: '1.25rem' }}>
            <div className="card-title">System Architecture Flow</div>
            <div className="flow-diagram">
              <div className="flow-box">User Request</div>
              <div className="flow-arrow">→</div>
              <div className="flow-box" style={{ borderColor: 'var(--accent-primary)' }}>ML Models<br/><span style={{ fontSize: '0.7rem', fontWeight: 400 }}>XGBoost + LightGBM</span></div>
              <div className="flow-arrow">→</div>
              <div className="flow-box-agent flow-box">Agent Orchestrator</div>
              <div className="flow-arrow">→</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div className="flow-box-agent flow-box" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>NBA Agent</div>
                <div className="flow-box-agent flow-box" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>Explainability Agent</div>
              </div>
              <div className="flow-arrow">→</div>
              <div className="flow-box">JSON Response</div>
            </div>
          </div>

          {/* Capabilities Table */}
          <div className="card">
            <div className="card-title">Agent Capabilities & Tools</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Replaces</th>
                    <th>Tools Used</th>
                    <th>Avg RT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>NBA</strong></td>
                    <td>PRD §13 rules</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_shap_drivers<br/>get_emi_data<br/>get_intervention_cost_table</td>
                    <td>~2-3s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Explainability</strong></td>
                    <td>NLG templates</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_shap_drivers<br/>get_peer_cohort_stats</td>
                    <td>~1-2s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Market Intel</strong></td>
                    <td>Thresholds</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_labor_market_data</td>
                    <td>~1-2s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Career Path</strong></td>
                    <td>Static tables</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_adjacent_fields<br/>get_labor_market_data</td>
                    <td>~2-4s</td>
                  </tr>
                  <tr>
                    <td><strong style={{ color: 'var(--accent-purple)' }}>Offer Survival</strong></td>
                    <td>Gradient Boost</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>get_company_health_signals</td>
                    <td>~1-2s</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AgenticInsights;