import { useState, useCallback } from 'react';

export interface ApiConfig {
  clientId: string;
  secret: string;
}

const STORAGE_KEY = 'toggleai_demo_config';

export function loadStoredConfig(): ApiConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ApiConfig;
  } catch {
    return null;
  }
}

export function saveConfig(config: ApiConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

const FEATURES = [
  { icon: '🚩', label: 'Feature Flags — all 6 lifecycle states' },
  { icon: '📊', label: 'Feature Analytics — track interactions' },
  { icon: '🚀', label: 'Progressive Delivery — pipeline simulation' },
  { icon: '🧪', label: 'A/B Experiments — exposure & conversions' },
  { icon: '📖', label: 'Learn — code snippets & architecture guide' },
];

interface Props {
  onConnect: (config: ApiConfig) => void;
}

export default function ApiKeySetup({ onConnect }: Props) {
  const [clientId, setClientId] = useState('');
  const [secret, setSecret]     = useState('');
  const [testing, setTesting]   = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    const trimmed = { clientId: clientId.trim(), secret: secret.trim() };
    if (!trimmed.clientId || !trimmed.secret) {
      setTestError('Client ID and Secret are required.');
      return;
    }

    setTesting(true);
    setTestError(null);

    try {
      // Quick connectivity check — GET /
      const apiBase = import.meta.env.VITE_TOGGLEAI_API_URL || 'https://toggleai.bindx.fun';
      const res = await fetch(`${apiBase}/`, {
        headers: {
          'X-Client-ID': trimmed.clientId,
          'X-Client-Secret': trimmed.secret,
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok && res.status !== 401 && res.status !== 403) {
        throw new Error(`Server responded with ${res.status}`);
      }

      saveConfig(trimmed);
      onConnect(trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setTestError(`⚠️ Could not reach server: ${msg}`);
    } finally {
      setTesting(false);
    }
  }, [clientId, secret, onConnect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConnect();
  };

  return (
    <div className="setup-page fade-up">
      <div className="setup-card">
        {/* Logo */}
        <div className="setup-logo">T</div>

        <h1 className="setup-title">Connect to ToggleAI</h1>
        <p className="setup-subtitle">
          Enter your project API keys to explore every SDK feature live — flags,
          analytics, progressive delivery, and A/B experiments.
        </p>

        {/* Fields */}
        <div className="input-group">
          <label className="input-label" htmlFor="clientId">Client ID (Public Key)</label>
          <input
            id="clientId"
            className="input-field"
            type="text"
            placeholder="pk_live_..."
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="input-hint">Found in Dashboard → Project → API Keys</p>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="secret">Secret Key</label>
          <input
            id="secret"
            className="input-field"
            type="password"
            placeholder="sk_live_..."
            value={secret}
            onChange={e => setSecret(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="input-hint">Keep this private — never commit to source control</p>
        </div>



        {testError && (
          <div className="info-box danger" style={{ marginBottom: 16 }}>
            <span className="info-box-icon">⚠️</span>
            <span>{testError}</span>
          </div>
        )}

        <button
          id="connect-btn"
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleConnect}
          disabled={testing}
        >
          {testing ? (
            <><span className="spinner" /> Connecting...</>
          ) : (
            '→ Connect &amp; Explore'
          )}
        </button>

        <div className="setup-divider" />

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          What you can do after connecting:
        </p>
        <div className="setup-features">
          {FEATURES.map(f => (
            <div key={f.label} className="setup-feature-item">
              <div className="setup-feature-icon">{f.icon}</div>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
