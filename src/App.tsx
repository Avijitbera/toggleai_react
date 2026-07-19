import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'
import { ToggleAIClient } from 'toggleai-sdk'
import ApiKeySetup, { loadStoredConfig, clearConfig, type ApiConfig } from './components/ApiKeySetup'
import Navigation, { type TabId } from './components/Navigation'
import FlagsTab from './components/FlagsTab'
import AnalyticsTab from './components/AnalyticsTab'
import ProgressiveDeliveryTab from './components/ProgressiveDeliveryTab'
import ExperimentsTab from './components/ExperimentsTab'
import LearnTab from './components/LearnTab'

// ─── Demo user ────────────────────────────────────────────────
const DEMO_USER = 'user-react-demo-1'
const API_BASE = import.meta.env.VITE_TOGGLEAI_API_URL || 'https://toggleai.bindx.fun';

// ─── Connection status type ───────────────────────────────────
type ConnStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// ─── Build client from config ─────────────────────────────────
function buildClient(cfg: ApiConfig): ToggleAIClient {
  return new ToggleAIClient({
    clientId: cfg.clientId,
    secret:   cfg.secret,
    pollingInterval: 15_000,   // Refresh every 15s in this demo
    sdkType: 'react',
  } as any)
}

export default function App() {
  const [config, setConfig]     = useState<ApiConfig | null>(null)
  const [activeTab, setTab]     = useState<TabId>('flags')
  const [connStatus, setStatus] = useState<ConnStatus>('disconnected')
  const [connMsg, setMsg]       = useState<string>('')
  const [initialized, setInit]  = useState(false)
  const clientRef               = useRef<ToggleAIClient | null>(null)

  // ── On mount: load stored config ─────────────────────────────
  useEffect(() => {
    const stored = loadStoredConfig()
    if (stored) setConfig(stored)
  }, [])

  // ── When config changes: init the client ─────────────────────
  useEffect(() => {
    if (!config) return

    // Close previous client
    if (clientRef.current) {
      try { clientRef.current.close() } catch { /* ignore */ }
      clientRef.current = null
    }

    setInit(false)
    setStatus('connecting')
    setMsg(`Connecting to ${API_BASE}…`)

    const client = buildClient(config)
    clientRef.current = client

    client.init()
      .then(() => {
        setStatus('connected')
        setMsg(`Connected to ${API_BASE}`)
        setInit(true)
      })
      .catch((err: Error) => {
        setStatus('error')
        setMsg(err.message || 'Connection failed')
        setInit(false)
      })

    return () => {
      try { client.close() } catch { /* ignore */ }
    }
  }, [config])

  // ── Handle new API key config from setup screen ───────────────
  const handleConnect = useCallback((cfg: ApiConfig) => {
    setConfig(cfg)
  }, [])

  // ── Disconnect / change keys ──────────────────────────────────
  const handleDisconnect = useCallback(() => {
    clearConfig()
    if (clientRef.current) {
      try { clientRef.current.close() } catch { /* ignore */ }
      clientRef.current = null
    }
    setConfig(null)
    setInit(false)
    setStatus('disconnected')
    setMsg('')
  }, [])

  // ─── Show setup screen if not configured ─────────────────────
  if (!config) {
    return <ApiKeySetup onConnect={handleConnect} />
  }

  const client = clientRef.current

  // ─── Status pill label ────────────────────────────────────────
  const statusLabel =
    connStatus === 'connected'    ? `● Connected` :
    connStatus === 'connecting'   ? `Connecting…` :
    connStatus === 'error'        ? `Error` :
    `Disconnected`

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-header-brand">
          <div className="brand-logo">T</div>
          <span className="brand-name">ToggleAI</span>
          <span className="brand-badge">SDK Demo</span>
        </div>

        <div className="header-right">
          <div
            className={`connection-pill ${connStatus}`}
            title={connMsg}
          >
            <span className="status-dot" />
            {statusLabel}
            {connStatus === 'connected' && (
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                &nbsp;·&nbsp;{API_BASE.replace(/^https?:\/\//, '')}
              </span>
            )}
          </div>

          <button
            id="change-keys-btn"
            className="btn-ghost"
            onClick={handleDisconnect}
            title="Change API keys"
          >
            ⚙ Change Keys
          </button>
        </div>
      </header>

      {/* ── Tab nav ── */}
      <Navigation active={activeTab} onSelect={setTab} />

      {/* ── Tab content ── */}
      {connStatus === 'error' && (
        <div
          className="tab-content"
          style={{ paddingTop: 32 }}
        >
          <div className="info-box danger">
            <span className="info-box-icon">⚠️</span>
            <div>
              <strong>Connection failed</strong> — {connMsg}
              <br />
              <span style={{ fontSize: 12 }}>
                Check your API keys and base URL, then{' '}
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--brand-primary)', cursor: 'pointer', padding: 0, fontSize: 12 }}
                  onClick={handleDisconnect}
                >
                  re-enter your keys
                </button>.
              </span>
            </div>
          </div>
        </div>
      )}

      {connStatus === 'connecting' && (
        <div className="tab-content" style={{ paddingTop: 48, textAlign: 'center' }}>
          <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
          <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>
            Initializing SDK — fetching project config…
          </p>
        </div>
      )}

      {(connStatus === 'connected' || connStatus === 'error') && client && (
        <main role="tabpanel">
          {activeTab === 'flags' && (
            <FlagsTab
              client={client}
              initialized={initialized}
              userId={DEMO_USER}
            />
          )}
          {activeTab === 'analytics' && (
            <AnalyticsTab
              client={client}
              initialized={initialized}
              userId={DEMO_USER}
            />
          )}
          {activeTab === 'delivery' && (
            <ProgressiveDeliveryTab
              initialized={initialized}
              client={client}
            />
          )}
          {activeTab === 'experiments' && (
            <ExperimentsTab
              client={client}
              initialized={initialized}
              userId={DEMO_USER}
            />
          )}
          {activeTab === 'learn' && <LearnTab />}
        </main>
      )}

      {/* Learn tab is always accessible even if disconnected */}
      {connStatus !== 'connected' && connStatus !== 'error' && activeTab === 'learn' && (
        <main role="tabpanel"><LearnTab /></main>
      )}
    </div>
  )
}
