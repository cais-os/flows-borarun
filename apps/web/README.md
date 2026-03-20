This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Meta Cloud API Setup

Set these variables in `.env.local`:

```bash
META_SYSTEM_TOKEN=...
META_APP_ID=...
META_APP_SECRET=...
META_PHONE_NUMBER_ID=...
META_WABA_ID=...
META_WEBHOOK_VERIFY_TOKEN=...
META_GRAPH_API_VERSION=v23.0
```

## Strava Setup

Set these variables in `.env.local`:

```bash
STRAVA_CLIENT_ID=...
STRAVA_CLIENT_SECRET=...
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
STRAVA_SCOPES=read,activity:read_all
```

In the Strava app configuration, register this callback URL:

```bash
https://seu-dominio.com/api/strava/callback
```

Before using the integration, apply the SQL migration in:

```bash
apps/web/supabase/migrations/20260309_strava_integration.sql
```

Available endpoints:

- `GET /api/meta/health`: checks if Meta credentials are configured and valid
- `GET /api/meta/templates`: loads WhatsApp templates from the configured WABA
- `POST /api/meta/send-test`: sends a WhatsApp test message using the configured phone number ID
- `POST /api/meta/subscribe`: subscribes the app to the configured WABA
- `GET /api/meta/webhook`: webhook verification endpoint for Meta
- `POST /api/meta/webhook`: inbound WhatsApp webhook endpoint for messages and statuses
- `GET /api/strava/health`: checks if Strava credentials are configured
- `GET /api/strava/connect?conversationId=...`: starts Strava OAuth for a conversation
- `GET /api/strava/callback`: receives the Strava OAuth callback
- `GET /api/strava/status?conversationId=...`: returns Strava status and recent activities
- `POST /api/strava/sync`: forces a sync for the selected conversation
- `POST /api/strava/send-link`: sends the Strava connect link to the athlete on WhatsApp

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
