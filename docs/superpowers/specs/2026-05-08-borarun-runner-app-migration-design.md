# BoraRun Runner App Migration Design

## Status

Approved direction from the user:

- Migrate the full BoraRun app into this repository so future improvements from the original app can keep flowing in.
- Keep the current flow builder app as-is.
- Add a new flow node named "Web App" that sends a personalized public runner-app link to the WhatsApp user.
- The runner app must be able to generate the training plan with AI inside the web app too.
- The public runner URL must include the user's phone number.
- Authentication, subscription UI, and subscription gating from the original BoraRun app are not part of the final runner experience. They can remain temporarily during migration if that keeps the app easier to move, but payment and premium rules belong to the current flows system.

## Context

The current repository has a Next.js flow builder in `apps/web`. It manages WhatsApp flows, conversations, payments, Strava links, PDF generation, and the post-plan sales flow. The existing PDF node generates a structured training plan with OpenAI, stores it in `conversations.flow_variables._training_plan`, creates a PDF, uploads it to Supabase Storage, and sends the PDF through WhatsApp.

The source BoraRun repository contains a separate Vite/React app in `apps/app`, plus backend code, Supabase migrations, Edge Functions, n8n assets, components, hooks, styles, and app-specific tables such as `training_plans`, `weekly_trainings`, `onboarding_data`, and `subscriptions`.

The main architectural risk is forcing the BoraRun Vite app into the existing Next.js app. That would make the migration harder, increase conflicts, and make future syncs from the BoraRun repository painful. The chosen design keeps the BoraRun app as a separate app inside the same repo.

## Goals

- Add the full BoraRun runner experience to this repository without disrupting the current flow builder.
- Preserve the BoraRun app structure enough that future updates from `cais-os/borarun` can be compared and merged with lower friction.
- Provide public, no-login athlete access from WhatsApp using a phone-based URL.
- Create a new flow node that sends the runner app link with configurable message text.
- Let the new node either generate a plan before sending the link or send a link to a plan that can be generated inside the runner app.
- Let the runner app generate a training plan with AI through a server-side API, never from the browser directly.
- Keep the current PDF flow available so the user can manually swap active flows after testing.
- Treat original BoraRun auth and subscription code as migration carry-over only, then remove or bypass it once the public runner route is stable.

## Non-Goals

- Do not replace the current active flow automatically.
- Do not remove the existing PDF node.
- Do not require athlete login for the first version of the runner link.
- Do not use the original BoraRun subscription gating, checkout, or plan-access rules in the final runner experience.
- Do not port the full flow builder into the BoraRun app.
- Do not expose OpenAI, Supabase service role, Stripe, or Mercado Pago secrets to the runner frontend.

## Architecture

The repo will contain two web apps:

- `apps/web`: current Next.js flow builder/admin app.
- `apps/runner`: migrated BoraRun runner app, initially based on the source `apps/app` Vite/React app.

Shared infrastructure remains under:

- `supabase`: migrations and local Supabase config.
- root or app-level package management as already used by the repo.

The new integration path is:

1. A WhatsApp flow reaches the new "Web App" node in `apps/web`.
2. The flow engine resolves the current conversation and phone number.
3. Depending on node settings, the engine either generates a plan immediately or only ensures the public runner record/link exists.
4. The engine stores link and plan metadata in Supabase.
5. The engine sends a WhatsApp message with `{{web_app_link}}` replaced.
6. The athlete opens `apps/runner` at a phone-based route.
7. The runner app loads the public plan by phone. If no generated plan exists yet, it can request server-side AI generation.

## Public URL

The route must include the phone number:

```text
/plano/:phone
```

Example:

```text
/plano/5511999999999
```

The link is public and no-login by product decision. Because phone-only URLs are easy to guess, the implementation should keep all mutation operations server-side and scoped. The initial read route can load the latest public runner profile/plan for that phone. If abuse or privacy issues appear, a later version can add an optional query token while keeping the phone visible:

```text
/plano/5511999999999?t=public_access_key
```

For this first design, the user-facing URL remains phone-based.

## Data Model

The migration should preserve BoraRun's app tables where practical, but add a bridge back to the current flow system.

Required concepts:

- A public runner profile keyed by normalized phone number.
- A link from runner profile to the source `conversations.id`.
- A generated training plan, compatible with the runner app UI.
- Weekly trainings, compatible with the runner app UI.
- A generation status so the app can show loading/error/retry states.

Implementation options for storage:

- Reuse BoraRun tables (`training_plans`, `weekly_trainings`, `onboarding_data`) after adapting migrations for this repo.
- Add bridge columns such as `conversation_id`, `phone`, and `organization_id` where needed.
- Keep `conversations.flow_variables._training_plan` updated for compatibility with the current coach and follow-up logic.

The implementation should avoid duplicating the same plan shape in many places. If the runner UI expects relational rows but the existing coach expects JSON, the generation service should create both from one normalized plan object.

## New Flow Node

Add a new node type in `apps/web`, tentatively:

```ts
webApp
```

Display label:

```text
Web App
```

Suggested configuration fields:

- `label`: node name.
- `messageText`: WhatsApp message body. Supports `{{web_app_link}}` and existing flow variables.
- `ctaButtonText`: optional. If present, send a WhatsApp CTA URL button instead of only a text link.
- `generationMode`: `generate_before_send` or `generate_in_app`.
- `aiPrompt`: optional custom prompt for training plan generation.
- `fallbackMessageText`: optional error message if link creation or generation fails.

Default message:

```text
Montei seu plano de corrida em uma experiencia interativa:

{{web_app_link}}

Por ali voce consegue ver as semanas, treinos e proximos passos com mais clareza.
```

Node execution behavior:

- Build the public link from the configured runner app origin plus normalized phone.
- Persist `_runner_app_link` in `conversations.flow_variables`.
- If `generationMode` is `generate_before_send`, generate the plan before sending the link and persist the result.
- If `generationMode` is `generate_in_app`, only create the runner profile/link and let the runner app generate when opened.
- Send either a CTA URL message or a normal text message.
- Insert the outbound message into `messages`.
- Continue to the next flow node normally.

## AI Generation

The runner app must not call OpenAI directly from the browser.

For the first implementation, keep server-side APIs in `apps/web` because it already has Next.js route handlers, Supabase service-role access, OpenAI integration, and the existing training-plan generator. The Vite runner app will call these APIs through a configured API base URL.

Add server-side APIs in `apps/web` to:

- Load the public runner context by phone.
- Generate a plan from conversation variables and/or runner onboarding data.
- Persist the normalized plan.
- Return the plan to the runner app.

The AI generation should reuse the current training-plan logic where possible:

- `PLANEJADOR_INICIAL_PROMPT`
- `normalizeTrainingPlan`
- current coach summary output

The generation service should produce:

- normalized plan JSON for `conversations.flow_variables._training_plan`
- coaching summary JSON for `_coaching_summary`
- relational runner-app rows for the migrated BoraRun UI

This avoids two separate AI plan generators drifting apart.

## Runner App Migration

Create `apps/runner` from the source BoraRun `apps/app`.

Initial adaptation:

- Keep Vite/React and React Router for lower migration risk.
- Keep BoraRun components, hooks, assets, and styles.
- Remove or bypass login requirements for the public plan route.
- Remove or bypass subscription checks, subscription banners, checkout pages, and plan-lock rules for the public runner experience.
- Add a public route `/plano/:phone`.
- Keep protected/authenticated routes only temporarily if they compile cleanly and do not block the public plan route. After the migration is stable, delete or isolate auth-dependent routes that are not needed.
- Adjust Supabase client usage so public reads go through safe server/API endpoints when needed.

The public route should be the first production-ready path. Other BoraRun app pages can remain present, but the migration is successful only when `/plano/:phone` can render the generated plan end to end.

## Auth And Subscription Scope

The final runner app should be a public plan viewer and training experience launched from WhatsApp. It should not own subscription state.

Authentication:

- No login is required to open `/plano/:phone`.
- Auth code from the original BoraRun app can be copied during the first migration only if removing it immediately would slow down the move.
- Auth-dependent pages should not be part of the critical public flow.
- After the public runner route works, remove or quarantine unused auth screens, auth hooks, and protected-route wrappers.

Subscriptions:

- The runner app should not decide whether the user is premium.
- The runner app should not create checkout sessions or manage customer portals.
- Subscription banners and week-locking from the original BoraRun app should be removed or bypassed.
- Premium conversion, payment links, subscription status, and follow-up messaging stay in `apps/web` through the flow builder, payment nodes, agentic loop, Stripe/Mercado Pago integrations, and conversation records.
- If the runner app needs to show a premium CTA, it should be presentation-only and route the user back to WhatsApp or a flow-generated payment path rather than owning billing logic.

## Supabase

Supabase migrations from the source BoraRun repo need review before copying. The first implementation should adapt the BoraRun tables for public phone-based runner access instead of depending on `auth.users` for the public plan route.

Use this storage direction:

- Add a `runner_profiles` bridge table keyed by `normalized_phone`, with `conversation_id`, `organization_id`, `generation_status`, `generated_at`, and optional `public_access_key`.
- Adapt or recreate `training_plans` so plans can belong to `runner_profile_id` for public WhatsApp users, while preserving compatibility with the original app's expected fields.
- Adapt or recreate `weekly_trainings` so each row belongs to `training_plan_id` and can be rendered by the BoraRun UI.
- Keep auth-owned columns from the source app only where authenticated app routes still need them; the public `/plano/:phone` route should not require `auth.users`.
- Do not migrate subscription tables as active runner-app dependencies unless another part of the existing flows system requires them.
- Keep `conversations.flow_variables._training_plan`, `_coaching_summary`, `_plan_generated_at`, and `_runner_app_link` updated for the flow builder and coach context.

Migration rules:

- Avoid collisions with existing tables and policies.
- Enable RLS on exposed tables.
- Do not expose service-role operations through public clients.
- Add indexes for phone and conversation lookup.
- Prefer server-side APIs for writes and plan generation.

Required bridge fields:

- `phone`
- `normalized_phone`
- `conversation_id`
- `organization_id`
- `public_access_key`
- `generation_status`
- `generated_at`

## Future Sync Strategy

To keep access to future improvements from the original BoraRun repo:

- Keep `apps/runner` close to the source structure.
- Minimize broad renames and framework rewrites.
- Isolate integration-specific code in clearly named files, such as `src/lib/public-plan-api.ts` or `src/pages/PublicPlan.tsx`.
- Prefer adapter functions over modifying many BoraRun components directly.
- Document any intentional divergence in `apps/runner/README.md`.

## Rollout

1. Add `apps/runner` and get it building locally.
2. Bypass auth and subscription checks for the public `/plano/:phone` path.
3. Add or adapt Supabase schema needed for runner plans.
4. Add public plan loading/generation APIs.
5. Add `/plano/:phone` to the runner app.
6. Add the new `Web App` node in the flow builder UI.
7. Add flow-engine execution for the node.
8. Verify with a test conversation and phone number.
9. Remove or isolate unused auth/subscription code after the migrated public path is stable.
10. Leave existing active flows unchanged.
11. User manually swaps the active flow from PDF node to Web App node after testing.

## Verification

Minimum verification before calling the implementation complete:

- `apps/web` typecheck/build or equivalent existing verification.
- `apps/runner` install/build.
- New Web App node appears in the flow builder palette.
- Node editor saves message text, CTA text, generation mode, and prompt.
- Flow engine sends a WhatsApp message with the correct public link.
- Public runner route opens by phone with no login.
- If no plan exists, the runner app can generate one through the server-side API.
- If a plan exists, the runner app renders it without regenerating.
- Public plan viewing is not blocked by login, trial status, subscription status, or week-locking logic from the original BoraRun app.
- Existing PDF node still works or remains untouched by the change.

## Open Implementation Notes

- The exact deployed runner app origin should come from env, for example `RUNNER_APP_BASE_URL`, falling back to the current request origin in local dev.
- Phone normalization should reuse existing WhatsApp/contact normalization patterns if present.
- The first implementation can keep phone-only public URLs, but all writes/generation must be guarded server-side to reduce abuse.
- The app should display clear pending and error states because AI generation can take time.
