import { useState, useCallback } from 'react';
import { ProgressiveErrorBoundary } from './ProgressiveErrorBoundary';
import { ToggleAIClient } from 'toggleai-sdk';

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface Props {
  initialized: boolean;
  client?: ToggleAIClient;
}

function BillingV2({ crash }: { crash: boolean }) {
  if (crash) {
    throw new Error('Critical payment processing error in Billing V2!');
  }
  return (
    <div style={{
      padding: '14px 16px',
      background: 'var(--green-bg)',
      border: '1px solid rgba(34,211,160,0.2)',
      borderRadius: 'var(--r-md)',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <span style={{ fontSize: 13, color: 'var(--green)', fontWeight: 500 }}>
          Billing V2 — Running Normally
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
        The pipeline canary is healthy. No error telemetry detected.
      </p>
    </div>
  );
}

export default function ProgressiveDeliveryTab({ initialized, client }: Props) {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [executionId, setExId]    = useState('');
  const [metricName, setMetric]   = useState('error_rate');
  const [metricValue, setMVal]    = useState(15);
  const [crash, setCrash]         = useState(false);
  const [sendingMetric, setSM]    = useState(false);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      { time: new Date().toLocaleTimeString(), text, type },
      ...prev,
    ].slice(0, 20));
  }, []);

  /* ── Send health metric to ToggleAI ingest ── */
  const sendHealthMetric = useCallback(async () => {
    if (!executionId.trim()) {
      addLog('⚠️ Enter an Execution ID first', 'error');
      return;
    }
    setSM(true);
    try {
      if (client) {
        await client.ingestPipelineHealthMetric(executionId.trim(), {
          metricName,
          value: Number(metricValue),
        });
        addLog(`✅ Health metric sent via SDK — ${metricName}=${metricValue} → execution ${executionId}`, 'success');
        if (metricValue >= 10) {
          addLog('🚨 Threshold breached (≥10)! Pipeline would auto-rollback in production.', 'error');
        }
      } else {
        const apiBase = import.meta.env.VITE_TOGGLEAI_API_URL || 'https://toggleai.bindx.fun';
        const url = `${apiBase}/sdk/executions/${encodeURIComponent(executionId.trim())}/health-metric`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metricName, value: Number(metricValue) }),
        });
        if (res.ok || res.status === 201) {
          addLog(`✅ Health metric sent — ${metricName}=${metricValue} → execution ${executionId}`, 'success');
          if (metricValue >= 10) {
            addLog('🚨 Threshold breached (≥10)! Pipeline would auto-rollback in production.', 'error');
          }
        } else {
          const text = await res.text();
          addLog(`❌ Server error ${res.status}: ${text}`, 'error');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      addLog(`❌ ${msg}`, 'error');
    } finally {
      setSM(false);
    }
  }, [executionId, metricName, metricValue, addLog, client]);

  /* ── Reset crash ── */
  const resetCrash = () => {
    setCrash(false);
    addLog('🔄 Billing V2 component recovered', 'info');
  };

  return (
    <div className="tab-content fade-up">
      <div className="page-header">
        <h2>Progressive Delivery Pipelines</h2>
        <p>
          ToggleAI's pipeline system lets you roll out features in stages with automated health checks.
          Each pipeline <strong>execution</strong> monitors real-time health metrics (error rate, latency, custom KPIs).
          If a threshold is breached, the pipeline auto-rolls back the flag.
        </p>
      </div>

      {/* How it works */}
      <div className="info-box info" style={{ marginBottom: 20 }}>
        <span className="info-box-icon">🔄</span>
        <div>
          <strong>How pipelines work:</strong> Create a Pipeline in the dashboard (e.g., "10% → 50% → 100%").
          Each stage advances only if health metrics stay within thresholds over the observation window.
          The SDK reports health metrics via <code>POST /sdk/executions/:id/health-metric</code>.
        </div>
      </div>

      {/* Live crash simulation */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Error Boundary + Auto Telemetry</div>
          <code className="card-meta">ProgressiveErrorBoundary</code>
        </div>
        <p className="card-body">
          Wrap your feature component in <code>ProgressiveErrorBoundary</code> with an <code>executionId</code>.
          If the component throws, the boundary automatically fires a health metric report to ToggleAI —
          triggering an automatic rollback of the pipeline stage.
        </p>

        <div className="input-group">
          <label className="input-label" htmlFor="exec-id">Execution ID (from Dashboard → Pipelines)</label>
          <input
            id="exec-id"
            className="input-field"
            placeholder="ex_01HZXXXXXXXXXXXX"
            value={executionId}
            onChange={e => setExId(e.target.value)}
          />
          <p className="input-hint">Paste a real pipeline execution ID to test automatic rollback telemetry</p>
        </div>

        {/* Wrapped component */}
        <ProgressiveErrorBoundary
          executionId={executionId || null}
          client={client}
          onError={msg => addLog(`🚨 ProgressiveErrorBoundary caught: ${msg}`, 'error')}
        >
          <BillingV2 crash={crash} />
          <div className="btn-group">
            <button
              id="simulate-crash-btn"
              className="btn btn-danger"
              onClick={() => { setCrash(true); addLog('💥 Crash simulated! Error boundary caught it.', 'error'); }}
              disabled={!initialized}
            >
              💥 Simulate Crash (Trigger Telemetry)
            </button>
            {crash && (
              <button className="btn btn-success" onClick={resetCrash}>
                🔄 Reset Component
              </button>
            )}
          </div>
        </ProgressiveErrorBoundary>
      </div>

      {/* Manual health metric */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Send Health Metric Manually</div>
          <code className="card-meta">POST /sdk/executions/:id/health-metric</code>
        </div>
        <p className="card-body">
          You can also send health metrics directly — useful for custom KPIs like latency (p95),
          API error rate, or business metrics (checkout failure rate).
          Metrics are evaluated against the pipeline's configured thresholds in real-time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="hm-exec">Execution ID</label>
            <input
              id="hm-exec"
              className="input-field"
              placeholder="ex_..."
              value={executionId}
              onChange={e => setExId(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="hm-name">Metric Name</label>
            <select
              id="hm-name"
              className="input-field"
              value={metricName}
              onChange={e => setMetric(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="error_rate">error_rate</option>
              <option value="latency_p95">latency_p95</option>
              <option value="crash_count">crash_count</option>
              <option value="custom_kpi">custom_kpi</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="hm-value">
              Value
              {metricValue >= 10 && (
                <span style={{ marginLeft: 8, color: 'var(--red)', fontSize: 10 }}>⚠️ exceeds threshold (10)</span>
              )}
            </label>
            <input
              id="hm-value"
              className="input-field"
              type="number"
              value={metricValue}
              onChange={e => setMVal(Number(e.target.value))}
            />
          </div>
        </div>

        <button
          id="send-metric-btn"
          className={`btn ${metricValue >= 10 ? 'btn-danger' : 'btn-primary'}`}
          onClick={sendHealthMetric}
          disabled={sendingMetric}
        >
          {sendingMetric
            ? <><span className="spinner" /> Sending…</>
            : `→ Send ${metricName}=${metricValue}`
          }
        </button>
      </div>

      {/* Pipeline stages explainer */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>Pipeline Stage Flow</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13 }}>
          {['0% → 10%', '→ health check (5 min)', '10% → 50%', '→ health check', '50% → 100%', '→ Fully Rolled Out ✅'].map((step, i) => (
            <span
              key={i}
              style={{
                padding: '5px 10px',
                background: step.startsWith('→') ? 'var(--brand-muted)' : 'var(--bg-elevated)',
                border: `1px solid ${step.startsWith('→') ? 'var(--border-brand)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--r-sm)',
                color: step.startsWith('→') ? 'var(--brand-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              {step}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
          If any health metric breaches its threshold during an observation window,
          the pipeline pauses and rolls back the flag automatically — no human intervention needed.
        </p>
      </div>

      {/* Log */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Pipeline Log</h3>
          {logs.length > 0 && <button className="btn-ghost" onClick={() => setLogs([])}>Clear</button>}
        </div>
        <div className="activity-log">
          {logs.length === 0
            ? <div className="log-empty">No pipeline events yet</div>
            : logs.map((l, i) => (
                <div key={i} className="log-entry">
                  <span className="log-time">{l.time}</span>
                  <span className={`log-text ${l.type}`}>{l.text}</span>
                </div>
              ))}
        </div>
      </div>
    </div>
  );
}
