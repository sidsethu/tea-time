# 🫖 Tea Time Rotation

A lightweight, real-time team tea-time coordinator. Start a session, everyone places orders, then fairly assign who makes tea based on history. Built with React + Supabase.

## Features

- Smart rotation: picks the assignee with the fewest total teas bought, then the least recently assigned
- Real-time updates: orders and session state update live across clients
- Preference memory: remembers each person’s last drink and sugar level
- Role-based actions: guard sensitive actions (summarize, abandon, add users) with permissions
- Polished UX: mobile-first, touch-friendly, premium styling

## Tech Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4
- Backend: Supabase (PostgreSQL, Realtime, Auth, Edge Functions)
- Edge Functions: summarize (assignment + rollup), user-sync (auth → users sync)

## Architecture Overview

- UI loads auth session and the current tea session
- Realtime listeners refresh orders/sessions on database changes
- Orders are upserted per user per session
- Summarize finalizes a session via an edge function that computes the assignee and writes rollups

## Getting Started

### Prerequisites

- Node.js 18+ 
- Docker Desktop (for Supabase)
- Supabase CLI: `brew install supabase/tap/supabase`

### Install & Run (local)

1) Install dependencies

   ```bash
   npm install
   ```

2) Start Supabase services

   ```bash
   supabase start
   ```

3) Initialize the database schema and sample data

   ```bash
   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f schema.sql
   ```

4) Configure environment

Create `.env.local` in `tea-time-rotation/`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=YOUR_LOCAL_ANON_KEY
```

Find the anon key from `supabase start` output or Supabase Studio.

5) Run edge functions locally (needed for summarize)

   ```bash
supabase functions serve
   ```

6) Start the frontend

   ```bash
   npm run dev
   ```

Open http://localhost:5173

## Environment

- `VITE_SUPABASE_URL`: Supabase API URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon key for client SDK

## Core Flows

- Session lifecycle: Start session → Team submits orders → Summarize → Session completes → Start a new one
- Assignment logic (edge function `summarize`):
  - Load all non-excused orders for the session with their users
  - Sort eligible users by `total_drinks_bought` asc, then `last_assigned_at` asc (nulls first)
  - Pick the first user as assignee
  - Persist rollups: update each user’s last drink/sugar, increment drink_count for participants, increment assignee’s total_drinks_bought by total orders, set session to completed with assignee and summarizer

## Database Model (public)

- `users`: id, name, auth_user_id, added_by, last_assigned_at, last_ordered_drink, last_sugar_level, total_drinks_bought, drink_count, profile_picture_url
- `roles`, `user_roles`, `role_permissions(permission enum)`: RBAC
- `sessions`: id, started_at, ended_at, status enum(active|completed), assignee_name, total_drinks_in_session, summarized_by
- `orders`: id, session_id, user_id, drink_type, sugar_level, is_excused, created_at
- Helpers: `increment_total_drinks_bought(p_user_id, p_amount)`, `increment_drink_count(user_id)`
- Constraint: unique partial index ensuring only one `active` session at a time

## Auth & Roles

- Auth: Supabase Auth with Google OAuth (button provided in UI)
- Profile loading joins `users` with `user_roles → roles → role_permissions`
- UI checks permissions like `can_add_user`, `can_summarize_session`, `can_abandon_session`, `can_update_order`, `can_cancel_order`
- The `user-sync` edge function links new auth users to `users` and assigns the `member` role

## Realtime

- Subscribes to `postgres_changes` on `sessions` and `orders`
- Any insert/update/delete triggers a refresh of UI state

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — type-check then build
- `npm run preview` — preview production build
- `npm run lint` — lint the codebase

## Troubleshooting

- Summarize does nothing: ensure `supabase functions serve` is running
- Auth redirect errors: add your dev origin to Supabase Auth redirect URLs; Google OAuth must be enabled in the project
- Realtime not updating: verify Supabase is running and your `VITE_SUPABASE_URL`/key are correct
- One active session only: enforced by a unique index; abandon or summarize before starting a new one

## Notes for Production

- Configure Supabase Auth providers (Google) with production URLs
- Add RLS policies to `users`, `orders`, `sessions`, and RBAC tables; none are defined in the dev schema here
- Deploy edge functions (`summarize`, `user-sync`) to Supabase
- Secure sensitive actions server-side as well (edge functions, RLS)

---

Built with React, TypeScript, Tailwind, and Supabase.
