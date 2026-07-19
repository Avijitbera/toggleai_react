import { useState } from 'react';

interface CodeSnippet {
  lang: string;
  code: string;
}

interface Step {
  num: number;
  title: string;
  body: string;
  snippet?: CodeSnippet;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  description: string;
  steps: Step[];
}

const SECTIONS: Section[] = [
  {
    id: 'setup',
    icon: '⚙️',
    title: 'Getting Started',
    description: 'Install the SDK and initialize the client with your project API keys.',
    steps: [
      {
        num: 1,
        title: 'Install the SDK',
        body: 'Install the ToggleAI TypeScript/JS SDK via npm, pnpm, or yarn.',
        snippet: {
          lang: 'bash',
          code: `npm install toggleai-sdk
# or
pnpm add toggleai-sdk`,
        },
      },
      {
        num: 2,
        title: 'Initialize the client',
        body: 'Create a single client instance (module-level singleton). Call init() once at startup — it fetches your project config from /sdk/config and starts background polling.',
        snippet: {
          lang: 'typescript',
          code: `import { ToggleAIClient } from 'toggleai-sdk';

const client = new ToggleAIClient({
  clientId: 'pk_live_xxx', // Public key
  secret:   'sk_live_xxx', // Secret key
  pollingInterval: 30_000, // Refresh every 30s (default)
  onReady: () => console.log('ToggleAI ready!'),
  onError: (err) => console.error('ToggleAI error:', err),
});

await client.init();`,
        },
      },
      {
        num: 3,
        title: 'Understand polling vs server-side mode',
        body: 'By default the SDK uses "local" evaluation: it caches the full config payload and evaluates flags in-memory (sub-millisecond, zero network calls per eval). For absolute latest state, use "server" mode which calls the backend on every evaluation.',
        snippet: {
          lang: 'typescript',
          code: `// Local mode (default) — fastest
const client = new ToggleAIClient({ clientId, secret });

// Server mode — real-time, but slower
const client = new ToggleAIClient({
  clientId, secret,
  evaluationMode: 'server',
});`,
        },
      },
    ],
  },
  {
    id: 'flags',
    icon: '🚩',
    title: 'Feature Flags',
    description: 'Evaluate boolean, string, number, and JSON flags with targeting rules.',
    steps: [
      {
        num: 1,
        title: 'Boolean flag evaluation',
        body: 'The most common case — gate a feature behind a true/false flag. Pass a user context for targeting rules (rollout %, segments, custom attributes).',
        snippet: {
          lang: 'typescript',
          code: `// Basic boolean flag
const isDarkMode = client.getFlag('dark-mode', { userId: 'user_42' });

// With targeting attributes (any extra key auto-becomes an attribute)
const showPremium = client.getFlag('premium-feature', {
  userId:  'user_42',
  country: 'US',
  plan:    'pro',
});

// With fallback default
const isEnabled = client.getFlag('new-checkout', ctx, false);`,
        },
      },
      {
        num: 2,
        title: 'Typed flag values (string / number / JSON)',
        body: 'For multivariate flags, use getFlagValue<T>() to get the typed value.',
        snippet: {
          lang: 'typescript',
          code: `// String flag — e.g. button color variant
const color = client.getFlagValue<string>('btn-color', ctx, 'blue');

// Number flag — e.g. max items per page
const limit = client.getFlagValue<number>('page-limit', ctx, 20);

// JSON flag — e.g. complex configuration
const layout = client.getFlagValue<{ columns: number }>('grid-layout', ctx);

// Full evaluation result (includes reason, variationKey)
const result = client.evaluateFlag('checkout-flow', ctx);
console.log(result.reason);       // "TARGETING_MATCH"
console.log(result.variationKey); // "variant_b"`,
        },
      },
      {
        num: 3,
        title: 'Evaluate all flags at once',
        body: 'For SSR or dashboard-style UIs, evaluate all flags in one call.',
        snippet: {
          lang: 'typescript',
          code: `const all = client.evaluateAllFlags({ userId: 'user_42' });
// { 'dark-mode': { value: true, reason: 'DEFAULT' }, ... }

// Or server-side (real-time from backend)
const remote = await client.evaluateAllFlagsRemote({ userId: 'user_42' });`,
        },
      },
    ],
  },
  {
    id: 'analytics',
    icon: '📊',
    title: 'Feature Analytics',
    description: 'Track how users interact with your features to power the lifecycle engine and AI insights.',
    steps: [
      {
        num: 1,
        title: 'Track a feature interaction',
        body: 'Call trackFeatureInteraction() after a user takes an action on a flagged feature. This is the main signal ToggleAI uses to determine flag health, detect zombie flags, and power churn predictions.',
        snippet: {
          lang: 'typescript',
          code: `await client.trackFeatureInteraction('billing-v2', {
  flagValue:      'true',          // The evaluated value
  eventType:      'click',         // view | click | submit | purchase | custom
  eventName:      'billing_click', // Your custom event name
  userIdentifier: 'user_42',       // Required
  eventValue:     29.99,           // Optional numeric value
  eventMetadata:  { source: 'checkout-page' }, // Optional JSON
});`,
        },
      },
      {
        num: 2,
        title: 'Batch tracking (performance)',
        body: 'For high-traffic apps, batch multiple events in a single HTTP request.',
        snippet: {
          lang: 'typescript',
          code: `await client.trackFeatureInteractionBatch([
  { flagKey: 'billing-v2',    eventType: 'view',  eventName: 'page_load',    userIdentifier: 'u1' },
  { flagKey: 'new-badge',     eventType: 'click', eventName: 'badge_click',  userIdentifier: 'u1' },
  { flagKey: 'dark-mode',     eventType: 'view',  eventName: 'theme_viewed', userIdentifier: 'u2' },
]);`,
        },
      },
      {
        num: 3,
        title: 'Generic event tracking (auto-attributed)',
        body: 'Fire business events without knowing which experiment is running. ToggleAI auto-attributes them to matching experiments.',
        snippet: {
          lang: 'typescript',
          code: `// Zero-code experiment attribution
await client.track({
  metricKey:      'purchase_completed',
  userIdentifier: 'user_42',
  value:          49.99,            // Optional
});`,
        },
      },
    ],
  },
  {
    id: 'delivery',
    icon: '🚀',
    title: 'Progressive Delivery',
    description: 'Safely roll out features in stages with automated health checks and rollbacks.',
    steps: [
      {
        num: 1,
        title: 'Report health metrics from your app',
        body: 'Send real-time health metrics (error rate, latency, custom KPIs) for a pipeline execution. If a metric breaches the configured threshold, ToggleAI automatically rolls back the feature flag.',
        snippet: {
          lang: 'typescript',
          code: `// Report to a specific pipeline execution
await fetch(\`\${baseUrl}/sdk/executions/\${executionId}/health-metric\`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    metricName: 'error_rate', // or 'latency_p95', 'crash_count'
    value: 3.2,               // Threshold: if ≥ 10, auto-rollback triggers
  }),
});`,
        },
      },
      {
        num: 2,
        title: 'Use ProgressiveErrorBoundary in React',
        body: 'Wrap any feature component. If it throws, the boundary automatically fires a health metric to ToggleAI — triggering automatic rollback of the pipeline stage without any manual intervention.',
        snippet: {
          lang: 'tsx',
          code: `import { ProgressiveErrorBoundary } from './ProgressiveErrorBoundary';

function App() {
  return (
    <ProgressiveErrorBoundary executionId="ex_01HZXXX">
      <BillingV2Feature />
    </ProgressiveErrorBoundary>
  );
}
// When BillingV2Feature throws → boundary catches → fires error_rate=15
// → ToggleAI detects threshold breach → auto-rollback pipeline`,
        },
      },
    ],
  },
  {
    id: 'experiments',
    icon: '🧪',
    title: 'A/B Experiments',
    description: 'Run hypothesis-driven experiments with automatic exposure tracking and statistical analysis.',
    steps: [
      {
        num: 1,
        title: 'Automatic exposure tracking',
        body: 'When you call evaluateFlag() for a flag tied to a running experiment, the SDK automatically records the user\'s exposure. No extra code needed.',
        snippet: {
          lang: 'typescript',
          code: `// Exposure is auto-recorded if 'checkout-flow' has a running experiment
const result = client.evaluateFlag('checkout-flow', { userId: 'user_42' });
// → SDK fires POST /sdk/expose in the background

console.log(result.variationKey); // "variant_b" or "control"`,
        },
      },
      {
        num: 2,
        title: 'Track conversions',
        body: 'After the user completes the measured action, call trackConversion(). ToggleAI uses conversion data to calculate statistical significance, uplift, and confidence intervals.',
        snippet: {
          lang: 'typescript',
          code: `const result = client.evaluateFlag('checkout-flow', ctx);
const variationId = client.resolveVariationId('checkout-flow', result.variationKey);

if (variationId) {
  await client.trackConversion({
    experimentId: 'exp_01HZXXX',
    variationId,
    metricKey:  'purchase_completed',
    userId:     'user_42',
    value:      49.99, // Optional revenue value
  });
}`,
        },
      },
    ],
  },
];

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{lang}</span>
        <button className={`code-copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}

const BACKEND_SERVICES = [
  { num: '01', name: 'Progressive Delivery',   desc: 'Pipeline stages, health metrics, auto-rollback' },
  { num: '02', name: 'Feature Analytics',       desc: 'Interaction tracking, lifecycle scoring, churn AI' },
  { num: '03', name: 'GitOps Flag Sync',         desc: 'Two-way GitHub sync, PR-based flag changes' },
  { num: '04', name: 'Feature Flags',            desc: 'Boolean, string, number, JSON flags with targeting' },
  { num: '05', name: 'Configs',                  desc: 'Key-value config store with versioning & revert' },
  { num: '06', name: 'A/B Experiments',          desc: 'Statistical significance, auto traffic allocation' },
  { num: '07', name: 'Audit Logs',               desc: 'Immutable change history across all resources' },
  { num: '08', name: 'Webhooks',                 desc: 'HMAC-signed outbound events on flag changes' },
  { num: '09', name: 'Scheduled Changes',        desc: 'Time-based flag rollouts without manual work' },
  { num: '10', name: 'AI Suggestions',           desc: 'Proactive insights, churn predictions, auto-experiments' },
  { num: '11', name: 'Lifecycle Manager',        desc: 'Daily staleness scanner, zombie flag detection' },
  { num: '12', name: 'Compliance & Audit',       desc: 'Approval workflows, SOC2 evidence export' },
  { num: '13', name: 'Event Streaming',          desc: 'Real-time SSE, webhook destinations, automation rules' },
];

export default function LearnTab() {
  const [openSection, setOpenSection] = useState<string | null>('setup');

  return (
    <div className="tab-content fade-up">
      <div className="page-header">
        <h2>Learn ToggleAI — SDK Guide</h2>
        <p>
          Step-by-step instructions for every SDK feature. Expand a section, copy the code snippet,
          and try it live in the other tabs.
        </p>
      </div>

      {/* Sections */}
      {SECTIONS.map(section => (
        <div key={section.id} className="detail-block">
          <summary
            className="detail-summary"
            style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
          >
            <span style={{ fontSize: 16 }}>{section.icon}</span>
            <span>{section.title}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>
              {openSection === section.id ? '−' : '+'}
            </span>
          </summary>

          {openSection === section.id && (
            <div className="detail-body">
              <p style={{ marginBottom: 16 }}>{section.description}</p>
              {section.steps.map(step => (
                <div key={step.num} className="learn-step">
                  <div className="step-number">{step.num}</div>
                  <div className="step-content">
                    <div className="step-title">{step.title}</div>
                    <p className="step-body">{step.body}</p>
                    {step.snippet && (
                      <CodeBlock lang={step.snippet.lang} code={step.snippet.code} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Backend Services Architecture */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header">
          <div className="card-title">Backend Architecture — 13 Services</div>
          <span className="chip">Cloudflare Workers + Turso + Upstash Redis</span>
        </div>
        <p className="card-body">
          The ToggleAI backend is a Cloudflare Worker (Hono framework) with a Turso (LibSQL) primary database,
          a separate logging database, and Upstash Redis for real-time counters and caching.
          All 13 services are independently addressable via scoped API routes.
        </p>
        <div className="arch-grid">
          {BACKEND_SERVICES.map(s => (
            <div key={s.num} className="arch-card">
              <div className="arch-card-num">SERVICE {s.num}</div>
              <div className="arch-card-name">{s.name}</div>
              <div className="arch-card-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Free Tier — Forever</div>
          <span className="lifecycle-badge healthy">INCLUDED</span>
        </div>
        <p className="card-body">
          Every organization starts with a permanent free tier — no credit card required.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {[
            ['⚡️', '50K', 'Evaluations/mo'],
            ['🚩', '10', 'Active Flags'],
            ['⚙️', '20', 'Configs'],
            ['🧪', '1', 'Experiment'],
            ['🪄', '5', 'AI Suggestions/mo'],
            ['📜', '7 days', 'Audit Retention'],
          ].map(([icon, val, label]) => (
            <div key={label as string} className="stat-card" style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
              <div className="stat-value" style={{ fontSize: '1.2rem' }}>{val}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
