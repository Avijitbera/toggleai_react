import { useState, useCallback } from 'react';
import { ToggleAIClient } from 'toggleai-sdk';

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface Props {
  client: ToggleAIClient;
  initialized: boolean;
  userId: string;
}

const EVENT_PRESETS = [
  { id: 'page_view',      label: 'Page View',       eventType: 'view'   as const, flagKey: 'billing-v2',      eventName: 'page_view' },
  { id: 'feature_click',  label: 'Feature Click',   eventType: 'click'  as const, flagKey: 'new-feature-badge', eventName: 'feature_clicked' },
  { id: 'form_submit',    label: 'Form Submit',     eventType: 'submit' as const, flagKey: 'old-onboarding-flow', eventName: 'onboarding_submitted' },
  { id: 'purchase',       label: 'Purchase Event',  eventType: 'purchase' as const, flagKey: 'billing-v2',  eventName: 'checkout_completed' },
];

export default function AnalyticsTab({ client, initialized, userId }: Props) {
  const [logs, setLogs]         = useState<LogEntry[]>([]);
  const [flagKey, setFlagKey]   = useState('billing-v2');
  const [eventName, setEventName] = useState('feature_used');
  const [eventType, setEventType] = useState<'view' | 'click' | 'submit' | 'purchase' | 'custom'>('click');
  const [flagValue, setFlagValue] = useState('true');
  const [metricKey, setMetricKey] = useState('conversion_rate');
  const [userId2, setUserId2]   = useState(userId);
  const [eventValue, setEventValue] = useState('');
  const [busy, setBusy]         = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [stats, setStats]       = useState({ interactions: 0, batched: 0, tracked: 0 });

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      { time: new Date().toLocaleTimeString(), text, type },
      ...prev,
    ].slice(0, 30));
  }, []);

  /* ── Track single interaction ── */
  const trackInteraction = useCallback(async () => {
    if (!initialized) { addLog('Client not initialized', 'error'); return; }
    setBusy(true);
    try {
      const result = await client.trackFeatureInteraction(flagKey, {
        flagValue,
        eventType,
        eventName,
        userIdentifier: userId2,
        eventValue: eventValue ? Number(eventValue) : undefined,
      });
      setStats(s => ({ ...s, interactions: s.interactions + 1 }));
      addLog(`✅ Tracked '${eventName}' on '${flagKey}' — interactionId: ${result.interactionId ?? 'ok'}`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Interaction tracking failed: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [initialized, client, flagKey, flagValue, eventType, eventName, userId2, eventValue, addLog]);

  /* ── Track generic event (auto-experiment attribution) ── */
  const trackEvent = useCallback(async () => {
    if (!initialized) { addLog('Client not initialized', 'error'); return; }
    setBusy(true);
    try {
      const result = await client.track({
        metricKey,
        userIdentifier: userId2,
        value: eventValue ? Number(eventValue) : 1,
      });
      setStats(s => ({ ...s, tracked: s.tracked + 1 }));
      addLog(`✅ track('${metricKey}') — attributed: ${result.attributed ?? 0} experiments`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Event track failed: ${msg}`, 'error');
    } finally {
      setBusy(false);
    }
  }, [initialized, client, metricKey, userId2, eventValue, addLog]);

  /* ── Batch track 3 events at once ── */
  const trackBatch = useCallback(async () => {
    if (!initialized) { addLog('Client not initialized', 'error'); return; }
    setBatchBusy(true);
    try {
      const result = await client.trackFeatureInteractionBatch([
        { flagKey: 'billing-v2',       flagValue: 'true',  eventType: 'view',  eventName: 'page_load',     userIdentifier: userId2 },
        { flagKey: 'new-feature-badge', flagValue: 'true', eventType: 'click', eventName: 'badge_clicked', userIdentifier: userId2 },
        { flagKey: 'legacy-dark-mode',  flagValue: 'false', eventType: 'view', eventName: 'theme_seen',    userIdentifier: userId2 },
      ]);
      setStats(s => ({ ...s, batched: s.batched + 3 }));
      addLog(`✅ Batch: ingested ${result.ingested} interactions in one request`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Batch track failed: ${msg}`, 'error');
    } finally {
      setBatchBusy(false);
    }
  }, [initialized, client, userId2, addLog]);

  /* ── Apply preset ── */
  const applyPreset = (p: typeof EVENT_PRESETS[0]) => {
    setFlagKey(p.flagKey);
    setEventName(p.eventName);
    setEventType(p.eventType as typeof eventType);
  };

  return (
    <div className="tab-content fade-up">
      <div className="page-header">
        <h2>Feature Analytics</h2>
        <p>
          Track how users interact with your feature flags. Every event is stored, aggregated,
          and used by ToggleAI's lifecycle scanner and AI suggestion engine. Events are sent
          via <code>POST /sdk/interactions</code> and auto-attributed to running experiments.
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.interactions}</div>
          <div className="stat-label">Interactions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.batched}</div>
          <div className="stat-label">Batched</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.tracked}</div>
          <div className="stat-label">Events Tracked</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.interactions + stats.batched + stats.tracked}</div>
          <div className="stat-label">Total Sent</div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: 12 }}>Quick Presets</div>
        <div className="btn-group">
          {EVENT_PRESETS.map(p => (
            <button key={p.id} id={`preset-${p.id}`} className="btn btn-secondary" onClick={() => applyPreset(p)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* trackFeatureInteraction */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Track Feature Interaction</div>
          <code className="card-meta">trackFeatureInteraction()</code>
        </div>
        <p className="card-body">
          Associates a user action (view/click/submit/purchase) with a specific feature flag evaluation.
          This powers the feature analytics dashboard, lifecycle state scoring, and churn predictions.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="ia-flagkey">Flag Key</label>
            <input id="ia-flagkey" className="input-field" value={flagKey} onChange={e => setFlagKey(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="ia-userid">User ID</label>
            <input id="ia-userid" className="input-field" value={userId2} onChange={e => setUserId2(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="ia-eventname">Event Name</label>
            <input id="ia-eventname" className="input-field" value={eventName} onChange={e => setEventName(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="ia-eventtype">Event Type</label>
            <select
              id="ia-eventtype"
              className="input-field"
              value={eventType}
              onChange={e => setEventType(e.target.value as typeof eventType)}
              style={{ cursor: 'pointer' }}
            >
              <option value="view">view</option>
              <option value="click">click</option>
              <option value="submit">submit</option>
              <option value="purchase">purchase</option>
              <option value="custom">custom</option>
            </select>
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="ia-flagvalue">Flag Value</label>
            <input id="ia-flagvalue" className="input-field" value={flagValue} onChange={e => setFlagValue(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="ia-eventvalue">Event Value (optional)</label>
            <input id="ia-eventvalue" className="input-field" type="number" placeholder="e.g. 29.99" value={eventValue} onChange={e => setEventValue(e.target.value)} />
          </div>
        </div>

        <div className="btn-group">
          <button id="track-interaction-btn" className="btn btn-primary" onClick={trackInteraction} disabled={!initialized || busy}>
            {busy ? <><span className="spinner" /> Sending…</> : '→ Track Interaction'}
          </button>
          <button id="batch-track-btn" className="btn btn-secondary" onClick={trackBatch} disabled={!initialized || batchBusy}>
            {batchBusy ? <><span className="spinner" /> Sending…</> : '⚡ Batch Track (3 events)'}
          </button>
        </div>
      </div>

      {/* track() — auto-experiment attribution */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Track Generic Event</div>
          <code className="card-meta">client.track()</code>
        </div>
        <p className="card-body">
          Fire a business metric event. ToggleAI auto-attributes it to any running experiments
          whose primary/secondary metrics match. You don't need to know which experiment is
          running — just fire meaningful events like <code>purchase_completed</code> or <code>signup_converted</code>.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="track-metric">Metric Key</label>
            <input id="track-metric" className="input-field" value={metricKey} onChange={e => setMetricKey(e.target.value)} placeholder="e.g. purchase_completed" />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label" htmlFor="track-value">Value</label>
            <input id="track-value" className="input-field" type="number" value={eventValue} onChange={e => setEventValue(e.target.value)} placeholder="1" />
          </div>
        </div>
        <button id="track-event-btn" className="btn btn-primary" onClick={trackEvent} disabled={!initialized || busy}>
          {busy ? <><span className="spinner" /> Sending…</> : '→ Track Event'}
        </button>
      </div>

      {/* Log */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Activity Log</h3>
          {logs.length > 0 && <button className="btn-ghost" onClick={() => setLogs([])}>Clear</button>}
        </div>
        <div className="activity-log">
          {logs.length === 0
            ? <div className="log-empty">No analytics events sent yet</div>
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
