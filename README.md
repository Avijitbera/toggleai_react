# ToggleAI React Integration Example — Feature Flags, A/B Testing & Canaries

This repository showcases the official React integration example for **[ToggleAI](https://toggleai.fun/)**, demonstrating how to implement real-time **feature flags**, **dynamic remote configuration**, **progressive canary releases**, and **A/B testing experiments** in a React application. 

This example project utilizes the universal [`toggleai-sdk`](https://www.npmjs.com/package/toggleai-sdk) to demonstrate best-practice patterns for frontend feature management, error log ingestion, and automatic pipeline rollbacks.

## 🔗 Key Resources

- 🌐 **Official Website**: [ToggleAI Feature Management Platform](https://toggleai.fun/)
- 📚 **Developer Documentation**: [ToggleAI Docs & Integration Guides](https://docs.toggleai.fun/)
- 📦 **NPM Package**: [toggleai-sdk on Registry](https://www.npmjs.com/package/toggleai-sdk)

---

## Features Demonstrated in this Example

This application provides an interactive playground for exploring the core capabilities of the ToggleAI SDK in a single-page React client:

1. 🚩 **Feature Flags & Targeting**: Instantly toggle components, change layouts, and segment users based on custom attributes (e.g. user plan, geographic location) with zero latency.
2. 🔄 **Dynamic Remote Configuration**: Retrieve operational constants, colors, and layout definitions dynamically from the cloud without redeploying code.
3. 🚀 **Progressive Delivery & Canary Stages**: Simulate multi-stage rollouts (e.g. 10% → 50% → 100%) and watch the client send telemetry.
4. 🚨 **Automated Canary Rollbacks**: Features a custom React `ProgressiveErrorBoundary` that catches rendering crashes and automatically sends error telemetry to the backend, triggering an automatic safety rollback.
5. 🧪 **A/B Testing Experiments**: Track user exposures to variations and log custom conversion events to calculate statistical significance.

---

## Getting Started

### 1. Installation

Clone this repository and install the dependencies:

```bash
# Clone the repository
git clone https://github.com/toggleai/toggleai-sdk.git
cd example/toggleai_react

# Install packages
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root of the React app directory to map the SDK to your local or staging backend. If not specified, the SDK defaults to `https://toggleai.bindx.fun`.

```env
VITE_TOGGLEAI_API_URL=https://api.toggleai.fun
```

### 3. Start the Development Server

```bash
npm run dev
```

---

## Implementation Details

### React SDK Client Initialization
The client is initialized once and shared across components:

```tsx
import { ToggleAIClient } from "toggleai-sdk";

const client = new ToggleAIClient({
  clientId: "your_client_id",
  secret: "your_secret_key",
  pollingInterval: 15000, // Background updates every 15 seconds
});

await client.init();
```

### Progressive Canary Rollback Simulation
To protect production traffic, ToggleAI allows you to define health thresholds for canary releases. In [ProgressiveErrorBoundary.tsx](src/components/ProgressiveErrorBoundary.tsx), we automatically report error rates and logs to the ToggleAI progressive delivery pipeline:

```tsx
public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  const { executionId, client } = this.props;

  if (executionId && client) {
    // 1. Report the error log event
    client.ingestPipelineExecutionLogs(executionId, {
      message: error.message,
      level: "error",
      stackTrace: error.stack,
    });

    // 2. Report a health metric indicating the error
    client.ingestPipelineHealthMetric(executionId, {
      metricName: "error_rate",
      value: 15, // Breaches the target threshold of 10
    });
  }
}
```

When the reported `error_rate` breaches the target threshold, the ToggleAI orchestrator immediately aborts the pipeline, resets the feature flag targeting to `0%` for the canary group, and restores the system to a known healthy state.

---

## Frequently Asked Questions (FAQ)

### How does ToggleAI prevent screen flickering during React rendering?
Screen flickering (or layout shift) is a common issue with client-side feature flagging. ToggleAI avoids this by evaluating flags **locally in-memory**. By calling `await client.init()` before rendering the React application root, the full configuration manifest is cached, allowing `client.getFlag()` to compute variations synchronously in less than `1ms`.

### Can I use this React example with Next.js or React Server Components (RSC)?
Yes. The underlying `@toggleai/sdk` is isomorphic. In Next.js, you can initialize the client in server-side files (e.g. `layout.tsx` or route handlers) to evaluate flags on the server and pass the configuration down to the client, preventing any layout shifts.

### Where do I obtain public Client IDs and secret keys?
Sign up at [ToggleAI](https://toggleai.fun/) and create a project. You can locate your environment credentials under **Project Settings → API Keys**.

---

## Support & Contributing

For feedback, questions, or integration assistance, visit our [Documentation Portal](https://docs.toggleai.fun/) or submit a GitHub issue.
