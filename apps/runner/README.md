# BoraRun Runner App

This app is migrated from `cais-os/borarun/apps/app`.

The production-critical route for this repository is `/plano/:phone`, which opens a no-login runner plan experience from WhatsApp.

Auth, subscription checkout, subscription gating, and premium rules are owned by `apps/web` and the flow system. Code copied from the original app that supports auth or subscription screens is migration carry-over only and can be removed after the public runner route is stable.

Local development:

```bash
npm install
npm run dev
```

Use `VITE_FLOW_API_BASE_URL` to point this app at the flow builder backend that serves public runner plan APIs.
