import { useState, useCallback } from 'react';
import { ToggleAIClient } from 'toggleai-sdk';

interface LogEntry {
  time: string;
  text: string;
  type: 'info' | 'success' | 'error';
}

interface FlagConfig {
  key: string;
  label: string;
  lifecycle: 'creation' | 'healthy' | 'stale' | 'zombie' | 'archive';
  lifecycleLabel: string;
  description: string;
  eventName: string;
  eventType: 'view' | 'click' | 'submit';
}

const FLAG_CONFIGS: FlagConfig[] = [
  {
    key: 'new-feature-badge',
    label: '1. Creation',
    lifecycle: 'creation',
    lifecycleLabel: 'CREATION',
    description: 'Newly created flag with no production traffic yet. This is the "just born" state — the flag exists but hasn\'t been evaluated in production.',
    eventName: 'badge_viewed',
    eventType: 'view',
  },
  {
    key: 'billing-v2',
    label: '2. Healthy',
    lifecycle: 'healthy',
    lifecycleLabel: 'HEALTHY',
    description: 'An actively used flag receiving regular evaluation traffic. ToggleAI confirms this is serving real users, so it stays in a "healthy" state.',
    eventName: 'billing_v2_click',
    eventType: 'click',
  },
  {
    key: 'legacy-dark-mode',
    label: '3. Stale',
    lifecycle: 'stale',
    lifecycleLabel: 'STALE',
    description: 'Traffic has dropped significantly over the past 14 days. ToggleAI\'s lifecycle scanner flagged it. Safe to review and clean up.',
    eventName: 'theme_toggle',
    eventType: 'click',
  },
  {
    key: 'zombie-promo-banner',
    label: '4. Zombie',
    lifecycle: 'zombie',
    lifecycleLabel: 'ZOMBIE',
    description: 'Code still references this flag but zero client-side evaluation events have arrived in 14+ days. It\'s a "dead" flag still lurking in your codebase.',
    eventName: 'promo_banner_click',
    eventType: 'click',
  },
  {
    key: 'old-onboarding-flow',
    label: '5. Ready to Archive',
    lifecycle: 'archive',
    lifecycleLabel: 'ARCHIVE READY',
    description: 'ToggleAI has determined this flag is safe to clean up. Use the dashboard to archive it — code cleanup is the final step.',
    eventName: 'onboarding_submit',
    eventType: 'submit',
  },
  {
    key: 'deprecated-search-bar',
    label: '6. Archived',
    lifecycle: 'archive',
    lifecycleLabel: 'ARCHIVED',
    description: 'This flag is archived on the ToggleAI console but code references still remain. ToggleAI can auto-detect these orphaned references.',
    eventName: 'archived_search',
    eventType: 'click',
  },
];

const LIFECYCLE_COLORS: Record<string, string> = {
  creation: 'creation',
  healthy:  'healthy',
  stale:    'stale',
  zombie:   'zombie',
  archive:  'archive',
};

interface Props {
  client: ToggleAIClient;
  initialized: boolean;
  userId: string;
}

export default function FlagsTab({ client, initialized, userId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [values, setValues]         = useState<Record<string, boolean>>({});

  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [
      { time: new Date().toLocaleTimeString(), text, type },
      ...prev,
    ].slice(0, 20));
  }, []);

  const evaluate = useCallback(async (flag: FlagConfig) => {
    if (!initialized) {
      addLog('Client not yet initialized', 'error');
      return;
    }
    setEvaluating(flag.key);
    const context = { userId };

    try {
      const val = client.getFlag(flag.key, context);
      setValues(prev => ({ ...prev, [flag.key]: val }));
      addLog(`Evaluated '${flag.key}' → ${val}`, 'info');

      await client.trackFeatureInteraction(flag.key, {
        flagValue: String(val),
        eventType: flag.eventType,
        eventName: flag.eventName,
        userIdentifier: userId,
      });
      addLog(`✅ Tracked '${flag.eventName}' (${flag.eventType})`, 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ ${msg}`, 'error');
    } finally {
      setEvaluating(null);
    }
  }, [client, initialized, userId, addLog]);

  const evaluateAll = useCallback(async () => {
    if (!initialized) return;
    addLog('Evaluating all flags…', 'info');
    const context = { userId };
    const results = client.evaluateAllFlags(context);
    const newValues: Record<string, boolean> = {};
    Object.entries(results).forEach(([key, r]) => {
      newValues[key] = Boolean(r.value);
    });
    setValues(newValues);
    addLog(`✅ Bulk evaluated ${Object.keys(results).length} flags`, 'success');
  }, [client, initialized, userId, addLog]);

  return (
    <div className="tab-content fade-up">
      <div className="page-header">
        <h2>Feature Flags — Lifecycle States</h2>
        <p>
          Every flag lives through a lifecycle: Created → Healthy → Stale → Zombie → Archived.
          ToggleAI's daily scanner automatically detects the state of each flag based on real evaluation traffic.
          Click <strong>Evaluate &amp; Track</strong> on any card to send a live SDK event.
        </p>
      </div>

      {/* Quick-fire all */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          id="evaluate-all-btn"
          className="btn btn-primary"
          onClick={evaluateAll}
          disabled={!initialized}
        >
          ⚡ Evaluate All Flags
        </button>
        <div className="info-box info" style={{ flex: 1, marginBottom: 0 }}>
          <span className="info-box-icon">💡</span>
          <span style={{ fontSize: 12 }}>
            <strong>Local evaluation</strong> — flags are cached from <code>/sdk/config</code>.
            Sub-millisecond latency, zero network calls per evaluation.
          </span>
        </div>
      </div>

      {/* Flag cards */}
      {FLAG_CONFIGS.map(flag => {
        const val = values[flag.key];
        const isEvaluating = evaluating === flag.key;
        return (
          <div key={flag.key} className="card" id={`flag-card-${flag.key}`}>
            <div className="card-header">
              <div className="card-title">
                {flag.label}
                <span className={`lifecycle-badge ${LIFECYCLE_COLORS[flag.lifecycle]}`}>
                  {flag.lifecycleLabel}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {val !== undefined && (
                  <span className={`flag-value-pill ${val ? 'true' : 'false'}`}>
                    {val ? '✓ true' : '✗ false'}
                  </span>
                )}
                <code className="card-meta">{flag.key}</code>
              </div>
            </div>
            <p className="card-body">{flag.description}</p>
            <button
              id={`eval-btn-${flag.key}`}
              className="btn btn-secondary"
              onClick={() => evaluate(flag)}
              disabled={!initialized || isEvaluating}
            >
              {isEvaluating
                ? <><span className="spinner" /> Evaluating…</>
                : '→ Evaluate & Track'
              }
            </button>
          </div>
        );
      })}

      {/* Activity log */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-header">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>SDK Activity Log</h3>
          {logs.length > 0 && (
            <button className="btn-ghost" onClick={() => setLogs([])}>Clear</button>
          )}
        </div>
        <div className="activity-log">
          {logs.length === 0 ? (
            <div className="log-empty">No events yet — click Evaluate &amp; Track above</div>
          ) : logs.map((l, i) => (
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
