import { useState, useCallback, useEffect } from 'react';
import { ToggleAIClient } from 'toggleai-sdk';

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface ActiveExperiment {
  experimentId: string;
  flagKey: string;
  variations: { id: string; key: string; allocation: number }[];
}

interface Props {
  client: ToggleAIClient;
  initialized: boolean;
  userId: string;
}

export default function ExperimentsTab({ client, initialized, userId }: Props) {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [experiments, setExps]    = useState<ActiveExperiment[]>([]);
  const [selVar, setSelVar]       = useState<Record<string, string>>({});
  const [experimentId, setExpId]  = useState('');
  const [variationId, setVarId]   = useState('');
  const [metricKey, setMetricKey] = useState('purchase_completed');
  const [convValue, setConvVal]   = useState('29.99');
  const [userId2, setUserId2]     = useState(userId);
  const [busy, setBusy]           = useState(false);

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      { time: new Date().toLocaleTimeString(), text, type },
      ...prev,
    ].slice(0, 25));
  }, []);

  /* ── Load experiments from cached SDK payload ── */
  useEffect(() => {
    if (!initialized) return;
    try {
      // evaluateAllFlags returns all flags; experiments come from the payload
      // The SDK exposes them via evaluateAllFlags context
      const all = client.evaluateAllFlags({ userId: userId2 });
      const exps: ActiveExperiment[] = [];

      Object.entries(all).forEach(([flagKey, result]) => {
        if (result.variationKey) {
          // Resolve variationId
          const varId = client.resolveVariationId(flagKey, result.variationKey);
          if (varId) {
            // Build a synthetic experiment entry for demo purposes
            exps.push({
              experimentId: `exp_${flagKey}`,
              flagKey,
              variations: [
                { id: varId, key: result.variationKey, allocation: 50 },
              ],
            });
          }
        }
      });

      setExps(exps);
      if (exps.length > 0) {
        addLog(`Loaded ${exps.length} active experiment(s) from SDK payload`, 'info');
      }
    } catch {
      // silently ignore if payload not ready
    }
  }, [initialized, client, userId2, addLog]);

  /* ── Record manual exposure ── */
  const recordExposure = useCallback(async () => {
    if (!initialized) { addLog('Client not initialized', 'error'); return; }
    if (!experimentId || !variationId) {
      addLog('⚠️ Experiment ID and Variation ID are required', 'error');
      return;
    }
    setBusy(true);
    try {
      await client.recordExposure({
        experimentId,
        variationId,
        userIdentifier: userId2,
      });
      addLog(`✅ Recorded exposure: ${userId2} → experiment ${experimentId} / variation ${variationId}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Exposure failed: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [initialized, client, experimentId, variationId, userId2, addLog]);

  /* ── Track conversion ── */
  const trackConversion = useCallback(async () => {
    if (!initialized) { addLog('Client not initialized', 'error'); return; }
    if (!experimentId || !variationId) {
      addLog('⚠️ Experiment ID and Variation ID are required', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await client.trackConversion({
        experimentId,
        variationId,
        metricKey,
        userId: userId2,
        value: convValue ? Number(convValue) : undefined,
      });
      addLog(`✅ Conversion tracked! Experiment: ${experimentId}, metric: ${metricKey}, value: ${convValue ?? 1}`, 'success');
      if (result.message) addLog(`   → ${result.message}`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Conversion tracking failed: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [initialized, client, experimentId, variationId, metricKey, convValue, userId2, addLog]);

  /* ── Auto-track via evaluateFlag (auto-exposure) ── */
  const autoExpose = useCallback(async (flagKey: string) => {
    if (!initialized) return;
    const result = client.evaluateFlag(flagKey, { userId: userId2 });
    addLog(`Auto-exposed '${userId2}' to flag '${flagKey}' → variation: ${result.variationKey ?? 'default'}`, 'success');

    // Store selected variation for form pre-fill
    if (result.variationKey) {
      const varId = client.resolveVariationId(flagKey, result.variationKey);
      if (varId) {
        setExpId(`exp_${flagKey}`);
        setVarId(varId);
        setSelVar(prev => ({ ...prev, [flagKey]: result.variationKey! }));
        addLog(`   Pre-filled form: experimentId=exp_${flagKey}, variationId=${varId}`, 'info');
      }
    }
  }, [initialized, client, userId2, addLog]);

  return (
    <div className="tab-content fade-up">
      <div className="page-header">
        <h2>A/B Experiments</h2>
        <p>
          ToggleAI's experiment engine runs hypothesis-driven A/B tests with statistical confidence tracking.
          Exposures are auto-recorded when you call <code>evaluateFlag()</code> for a flag tied to a running experiment.
          Conversions are tracked manually via <code>trackConversion()</code>.
        </p>
      </div>

      {/* How it works */}
      <div className="info-box info" style={{ marginBottom: 20 }}>
        <span className="info-box-icon">🧪</span>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <strong>Experiment Flow:</strong><br />
          1. Create an experiment in the dashboard, link it to a feature flag<br />
          2. SDK auto-records <strong>exposure</strong> when <code>evaluateFlag()</code> is called<br />
          3. When user completes the action, call <code>trackConversion()</code><br />
          4. ToggleAI calculates statistical significance, p-value, and variance automatically
        </div>
      </div>

      {/* Active experiments from payload */}
      {experiments.length > 0 ? (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Active Experiments in Your Project
          </div>
          {experiments.map(exp => (
            <div key={exp.experimentId} className="experiment-card">
              <div className="experiment-header">
                <div>
                  <div className="card-title" style={{ marginBottom: 4 }}>
                    Flag: <code style={{ fontSize: 12 }}>{exp.flagKey}</code>
                  </div>
                  <code className="card-meta">{exp.experimentId}</code>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => autoExpose(exp.flagKey)}
                  disabled={!initialized}
                >
                  Auto-Expose User
                </button>
              </div>
              <div className="experiment-body">
                <div className="variation-grid">
                  {exp.variations.map(v => (
                    <div
                      key={v.id}
                      className={`variation-card ${selVar[exp.flagKey] === v.key ? 'selected' : ''}`}
                      onClick={() => {
                        setExpId(exp.experimentId);
                        setVarId(v.id);
                        setSelVar(prev => ({ ...prev, [exp.flagKey]: v.key }));
                      }}
                    >
                      <div className="variation-key">{v.key}</div>
                      <div className="variation-alloc">{v.allocation}% traffic</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🧪</div>
            <div className="empty-state-title">No active experiments detected</div>
            <p className="empty-state-desc">
              Create an experiment in the ToggleAI dashboard and link it to a feature flag.
              Then click "Auto-Expose User" here after the flag is evaluated.
            </p>
          </div>
        </div>
      )}

      {/* Manual exposure */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Record Exposure Manually</div>
          <code className="card-meta">client.recordExposure()</code>
        </div>
        <p className="card-body">
          Use this for server-side rendering where you need explicit exposure tracking
          without calling <code>evaluateFlag()</code> on the client.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="exp-id">Experiment ID</label>
            <input id="exp-id" className="input-field" value={experimentId} onChange={e => setExpId(e.target.value)} placeholder="exp_..." />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="exp-var">Variation ID (UUID)</label>
            <input id="exp-var" className="input-field" value={variationId} onChange={e => setVarId(e.target.value)} placeholder="var_..." />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="exp-user">User ID</label>
            <input id="exp-user" className="input-field" value={userId2} onChange={e => setUserId2(e.target.value)} />
          </div>
        </div>
        <button id="expose-btn" className="btn btn-primary" onClick={recordExposure} disabled={!initialized || busy}>
          {busy ? <><span className="spinner" /> Sending…</> : '→ Record Exposure'}
        </button>
      </div>

      {/* Track conversion */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Track Conversion</div>
          <code className="card-meta">client.trackConversion()</code>
        </div>
        <p className="card-body">
          Record that the user completed the metric being measured (purchase, signup, etc.).
          ToggleAI uses this to calculate the conversion rate delta between variants and determine
          the winner with statistical confidence.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="conv-metric">Metric Key</label>
            <input id="conv-metric" className="input-field" value={metricKey} onChange={e => setMetricKey(e.target.value)} placeholder="purchase_completed" />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="conv-value">Value (optional)</label>
            <input id="conv-value" className="input-field" type="number" value={convValue} onChange={e => setConvVal(e.target.value)} placeholder="29.99" />
          </div>
        </div>
        <button id="convert-btn" className="btn btn-success" onClick={trackConversion} disabled={!initialized || busy}>
          {busy ? <><span className="spinner" /> Sending…</> : '→ Track Conversion'}
        </button>
      </div>

      {/* Log */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Experiment Log</h3>
          {logs.length > 0 && <button className="btn-ghost" onClick={() => setLogs([])}>Clear</button>}
        </div>
        <div className="activity-log">
          {logs.length === 0
            ? <div className="log-empty">No experiment events yet</div>
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
