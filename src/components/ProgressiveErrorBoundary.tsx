import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ToggleAIClient } from "toggleai-sdk";

interface Props {
  children: ReactNode;
  /** Pipeline execution ID — required to trigger automatic rollback telemetry */
  executionId: string | null;
  /** Optional callback fired when an error is caught */
  onError?: (message: string) => void;
  /** The ToggleAIClient instance to send telemetry */
  client?: ToggleAIClient;
}

interface State {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * ProgressiveErrorBoundary
 *
 * Wraps a feature component. When it throws, the boundary:
 * 1. Catches the error and shows a fallback UI
 * 2. Automatically fires a health metric to ToggleAI's pipeline ingest API
 *    (POST /sdk/executions/:id/health-metric with error_rate=15)
 * 3. ToggleAI detects the threshold breach and triggers an automatic rollback
 *
 * Use this around any feature gated by a progressive delivery pipeline.
 */
export class ProgressiveErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ProgressiveErrorBoundary] Uncaught error:", error, errorInfo);

    const { executionId, onError, client } = this.props;
    onError?.(error.message);

    if (!executionId) {
      console.warn(
        "⚠️ No executionId provided to ProgressiveErrorBoundary. " +
        "Automatic rollback telemetry will NOT be sent."
      );
      return;
    }

    if (client) {
      // 1. SDK method: report error log event
      client.ingestPipelineExecutionLogs(executionId, {
        message: error.message,
        stackTrace: error.stack || errorInfo.componentStack || undefined,
        level: "error",
      })
        .then(() => console.log("🚨 [ProgressiveErrorBoundary] Auto-reported error log to ToggleAI via SDK!"))
        .catch(err => console.error("[ProgressiveErrorBoundary] Failed to report error log via SDK:", err));

      // 2. SDK method: report error_rate health metric
      client.ingestPipelineHealthMetric(executionId, {
        metricName: "error_rate",
        value: 15,
      })
        .then(() => console.log("🚨 [ProgressiveErrorBoundary] Auto-reported error_rate=15 to ToggleAI via SDK!"))
        .catch(err => console.error("[ProgressiveErrorBoundary] Failed to report metric via SDK:", err));
    } else {
      const api = import.meta.env.VITE_TOGGLEAI_API_URL || 'https://toggleai.bindx.fun';

      // 1. Fallback: report error log event to ToggleAI's logging DB
      fetch(`${api}/sdk/executions/${encodeURIComponent(executionId)}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error.message,
          stackTrace: error.stack || errorInfo.componentStack || undefined,
          level: "error",
        }),
      })
        .then(() => console.log("🚨 [ProgressiveErrorBoundary] Auto-reported error log to ToggleAI!"))
        .catch(err => console.error("[ProgressiveErrorBoundary] Failed to report error log:", err));

      // 2. Fallback: report error_rate health metric to trigger auto-rollback (for custom webhooks compatibility)
      fetch(`${api}/sdk/executions/${encodeURIComponent(executionId)}/health-metric`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricName: "error_rate",
          value: 15, // Exceeds the default threshold of 10 → triggers rollback
        }),
      })
        .then(() => console.log("🚨 [ProgressiveErrorBoundary] Auto-reported error_rate=15 to ToggleAI!"))
        .catch(err => console.error("[ProgressiveErrorBoundary] Failed to report metric:", err));
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "14px 16px",
            backgroundColor: "var(--red-bg, rgba(255,92,108,0.1))",
            border: "1px solid rgba(255,92,108,0.3)",
            borderRadius: "var(--r-md, 10px)",
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>🚨</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--red, #ff5c6c)", marginBottom: 4 }}>
                Component Error — Fallback Active
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary, #8892a4)", margin: 0, fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                {this.state.errorMessage}
              </p>
              {this.props.executionId ? (
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #4a5568)", margin: "8px 0 0" }}>
                  ✅ Health metric auto-reported to pipeline execution{" "}
                  <code style={{ fontSize: 11 }}>{this.props.executionId}</code>.
                  Rollback may be triggered.
                </p>
              ) : (
                <p style={{ fontSize: 11.5, color: "var(--text-muted, #4a5568)", margin: "8px 0 0" }}>
                  ⚠️ No executionId — automatic rollback telemetry not sent.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
