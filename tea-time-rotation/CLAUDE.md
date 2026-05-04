# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

**Tea Time Rotation** coordinates team tea sessions. Users place drink orders; the app assigns who makes tea using a cost-weighted fairness ratio (`total_cost_consumed / total_cost_sponsored`). The person who has consumed the most relative to what they've sponsored gets assigned.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Type-check (tsc -b) + build production bundle to /dist
npm run lint      # Run ESLint
npm run preview   # Preview production build locally
```

There is no test framework configured — verification is manual.

For Supabase edge functions (Deno/TypeScript in `supabase/functions/`):
```bash
supabase functions serve summarize   # Serve summarize edge function locally
supabase functions deploy summarize  # Deploy to production
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Local Supabase ports (from `supabase/config.toml`): API 54321, DB 54322, Studio 54323.

## Architecture

### Tech Stack
- **Frontend:** React 19 + TypeScript + Tailwind CSS v4, bundled with Vite (PWA)
- **Backend:** Supabase (PostgreSQL + Auth + Realtime + Edge Functions written in Deno/TypeScript)
- **No routing framework** — single-page app; UI state drives which view is shown

### Frontend (`src/`)

**`App.tsx`** is the main orchestrator: manages session lifecycle, realtime subscriptions (to `sessions` and `orders` tables), modal state, and renders the correct view based on state:
- Not logged in → `Auth` component (Google OAuth)
- No active session → start session UI / recent `Summary`
- Active session → `OrderForm`
- Completed session → `Summary`

**`hooks/useAuth.ts`** resolves auth session → profile → RBAC by joining `users → user_roles → roles → role_permissions`. The `profile.permissions` array gates all UI actions client-side.

**`supabaseClient.ts`** — single Supabase client instance used throughout.

### Edge Functions (`supabase/functions/`)

**`summarize/index.ts`** — called when an admin ends a session:
- Phase 1 (no DB writes): ranks users by cost ratio, returns top 2 candidates
- Phase 2 (confirmed): resolves drink prices via wildcard logic (exact → drink wildcard → sugar wildcard → full wildcard), increments cost/count columns via RPCs, updates session atomically (race-condition safe)

**`user-sync/index.ts`** — auth webhook triggered on new user creation; creates the `users` row and assigns `member` role.

### Database Key Tables

| Table | Purpose |
|-------|---------|
| `users` | Team members; tracks `total_cost_sponsored` and `total_cost_consumed` |
| `sessions` | Tea sessions; only one `active` session enforced by partial unique index |
| `orders` | One order per user per session; has `drink_type`, `sugar_level`, `is_excused` |
| `drink_prices` | Price per (drink_type, sugar_level) combo; wildcard rows use `*` |
| `drinks` | Data-driven drink catalog (name, emoji, is_popular, is_active) |
| `roles` / `user_roles` / `role_permissions` | RBAC; roles are `admin` and `member` |

Schema is in `schema.sql` (baseline) and `migration.sql` (recent additions for cost tracking and drinks).

### RBAC Permissions
Permissions checked via `profile.permissions` array in React:
`can_add_user`, `can_summarize_session`, `can_abandon_session`, `can_update_order`, `can_cancel_order`, `can_disable_user`, `can_manage_prices`, `can_add_drink`

Admins get all permissions; members get limited subset.

### Realtime
`App.tsx` subscribes to Supabase realtime channels for `sessions` and `orders` tables. Changes trigger refetches of session/order state. Subscriptions are cleaned up on unmount.
