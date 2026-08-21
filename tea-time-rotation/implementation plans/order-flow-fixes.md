# Order Flow Fixes — Implementation Plan

## Context

Three unrelated defects/gaps surfaced in day-to-day use:

1. **Order counter over-counts.** The progress ring on the order form reads `x/y`, where `y` is every row in the `users` table. Retired users (`isActive = false`) are deliberately kept in that list so `OrderForm` can render them greyed out with a "Retired" badge — but they inflate the denominator, so the ring can never reach 100% and "🎉 Everyone has submitted!" never fires.

2. **Success popup lands off-screen.** After a bulk order submit, the confirmation popup appears far down the page and the user has to scroll to find it. Root cause: `src/App.tsx:619` puts `backdrop-blur-sm` on the main card. Per CSS spec a non-`none` `backdrop-filter` establishes a **containing block for `position: fixed` descendants**, so every modal rendered from inside `OrderForm` resolves `fixed inset-0` against that very tall card instead of the viewport — `items-center` then centres it at the card's midpoint. The single-order path never calls `showSuccess`, which is why only bulk mode shows the symptom.

3. **No manual assignee override.** The confirm-assignment modal offers only the top 2 fairness-ranked candidates. Admins sometimes need to assign someone else who is in the session.

Intended outcome: an accurate counter, popups reliably centred in the viewport, and an admin escape hatch to pick any active drinker as tea maker.

---

## 1. Counter should ignore retired users

### `src/components/OrderForm.tsx`

At L160-161, leave `submittedUsers` untouched — it is also consumed by `hasSubmitted` (L162), the bulk permission check (L204) and the per-tile "✓ ordered" badges, and narrowing it there would strip the badge from a user retired mid-session. Add separate counter-only values instead:

```ts
const submittedUsers = orders.map((order) => order.user_id);   // unchanged
const activeUsers = users.filter((u) => u.isActive);
const totalUsers = activeUsers.length;
const submittedCount = activeUsers.filter((u) => submittedUsers.includes(u.id)).length;
```

Then swap `submittedUsers.length` → `submittedCount` at the three consumer sites:

- **L473** ring arc — also guard divide-by-zero:
  `strokeDasharray={`${(totalUsers > 0 ? submittedCount / totalUsers : 0) * 251.2} 251.2`}`
- **L485** the `x/y` badge
- **L494-500** status text — gate the "Everyone has submitted!" branch on `totalUsers > 0` so an empty roster doesn't celebrate

---

## 2. Popups must centre in the viewport

Fix the containing-block problem at the source rather than removing the blur (any future `transform`/`filter` ancestor would reintroduce it). Render modals into `document.body` via a portal, so `position: fixed` always resolves against the viewport.

### New file: `src/components/ui/ModalPortal.tsx`

```tsx
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

const ModalPortal = ({ children }: { children: ReactNode }) =>
  createPortal(children, document.body);

export default ModalPortal;
```

`react-dom` 19 is already a dependency; there are currently no portals anywhere in `src/`.

Wrap the outermost `fixed inset-0` element of each modal in `<ModalPortal>`:

| File | Element to wrap |
|---|---|
| `src/components/ui/Modal.tsx` | the `return (...)` root at L67 — **this is the one that fixes the reported bug** |
| `src/components/OrderForm.tsx` | inline User Stats modal, L1178 |
| `src/components/AddUserModal.tsx` | root at L57 |
| `src/components/AddDrinkModal.tsx` | root at L72 |
| `src/components/ManagePricesModal.tsx` | root at L90 |
| `src/components/ui/PinModal.tsx` | root at L45 |
| `src/App.tsx` | assignee modal, L798 |

The last three aren't strictly affected today (they render as siblings of the blurred card), but wrapping them keeps behaviour uniform and immune to future layout changes.

Keep the existing `scrollIntoView` at `OrderForm.tsx:258` — once the modal is portaled it stays centred while the page scrolls to the progress ring behind the backdrop, which is the desired end state after dismiss. Do **not** add a body scroll lock; it would cancel that intentional scroll.

---

## 3. "Select Manually" on the confirm-assignment modal

**Scope:** active users who placed a real (non-excused) order in this session.

That set is exactly what `supabase/functions/summarize/index.ts` already accepts (it derives candidates from `orders` filtered on `is_excused = false`, then validates `confirm_assignee` against that same list at L96-104), so **no edge function change and no redeploy is required.**

Crediting is also already correct — Phase 2 charges `last_assigned_at`, `increment_total_drinks_bought` and `increment_total_cost_sponsored` (full session cost, including guest drinks) to whoever is confirmed, at `summarize/index.ts:203-215`, regardless of how they were chosen.

All changes are in `src/App.tsx`:

### a. Type fix

The `Order` interface at L25-29 omits `is_excused` even though `fetchAllData` selects `*`. Add:

```ts
is_excused: boolean;
```

### b. State

Alongside `candidates` / `selectedAssignee` (L76-77) add:

```tsx
const [manualSelect, setManualSelect] = useState(false);
```

### c. Derive participants

No extra queries — `orders` and `users` are already in state and kept fresh by the realtime subscriptions:

```tsx
const sessionParticipants = orders
  .filter((o) => !o.is_excused)
  .map((o) => users.find((u) => u.id === o.user_id))
  .filter((u): u is User => !!u && u.isActive)
  .sort((a, b) => a.name.localeCompare(b.name));
```

This mirrors the edge function's eligibility set, so anything picked from it will pass the Phase 2 validation.

### d. Modal body (L813-856)

Branch on `manualSelect`:

- **false** — render `candidates` exactly as today
- **true** — render `sessionParticipants` in a scrollable container (`max-h-[45vh] overflow-y-auto`) using the same radio-label markup

Reuse the existing `calculateRatio` (L335) and `formatLastAssigned` (L343) helpers. Show the ⭐ Recommended badge on whoever matches `candidates[0]?.id` so the fairness signal isn't lost in the longer list, and change the heading copy to something like "Pick anyone from this session". Render a short empty-state line if `sessionParticipants` is empty.

### e. Footer (L858-874)

Three buttons won't fit the current single `flex-row`. Restructure as two rows:

- "✓ Confirm Assignment" full width on top
- then a row with "👤 Select Manually" (or "← Back to Recommendations" when `manualSelect` is true) beside "Cancel"

### f. State hygiene

- `handleCancelAssigneeSelection` (L474-478) must also `setManualSelect(false)`
- Switching *back* to recommendations: if `selectedAssignee` is no longer one of the two candidates, reset it to `candidates[0]?.id` so the radio group isn't left with nothing checked
- Switching *into* manual mode: keep `selectedAssignee` — it is always a valid participant

### g. Styling

Use inline `style={{ backgroundColor: '#...' }}` for the new button, matching the existing precedent at L861 and L871.

Reason: Tailwind v4 is in use via `@import "tailwindcss"` with no `@config`/`@theme` block, so `tailwind.config.js` is never loaded and the custom `primary-*` / `chai-*` palette classes never compile — which is why the existing buttons already hard-code hex. Pre-existing issue, out of scope here; just don't add new code that depends on those class names.

---

## Out of scope (noted, not changed)

- `summarize/index.ts` does not filter on `isActive` when ranking, so a user retired mid-session can still appear among the recommended candidates. The new manual list filters them out.
- `supabase.functions.invoke` collapses non-2xx bodies into a generic `FunctionsHttpError`, so the `error.message?.includes('Session already summarized')` branch at `App.tsx:441` rarely fires as written.
- `fetchAllData` is duplicated at `App.tsx:174-191` and `App.tsx:280-297`.
- The dead Tailwind config described in 3g.

---

## Verification

No test framework is configured — verification is manual.

```bash
npm run build   # tsc -b type-check + production bundle
npm run lint
npm run dev     # http://localhost:5173
```

Then, signed in as an admin with an active session:

1. **Counter.** Note the `x/y` badge. Long-press a user tile for 2s to retire them → `y` drops by one and the "Retired" badge appears. Have every remaining active user order → ring reaches 100% and shows "🎉 Everyone has submitted!". Un-retire to restore.

2. **Popup centring.** Emulate a narrow/mobile viewport so the card is tall. In Bulk Order mode pick a drink, select several users, submit → the "Bulk Order Placed!" popup must be centred in the viewport with **no scrolling**. Repeat for an error popup (submit with no users selected) and for the User Stats modal (tap a retired tile). Confirm in DevTools that the modal is now a direct child of `<body>`.

3. **Manual assign.** End the session → confirm modal shows the 2 candidates → click "Select Manually" → the full participant list appears (excused and retired users absent) → pick someone who is *not* a candidate → Confirm. The `Summary` view should name them as tea maker. Verify in Supabase Studio (http://localhost:54323, `users` table) that their `total_drinks_bought` rose by the session drink count and `total_cost_sponsored` by the full session cost (including guest drinks), and `last_assigned_at` is now. Also check "← Back to Recommendations" and "Cancel" leave no stale selection behind.
