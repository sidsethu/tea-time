# Guest Drink Feature — Implementation Plan

## Context

Team members sometimes bring guests who also want tea. The guest's drink should be billed to the team member who brought them — incrementing that person's `drink_count` and `total_cost_consumed` so the fairness algorithm accounts for the extra consumption. Only admins can add or remove guest drinks. Regular orders are unchanged.

---

## Database Changes (new migration file)

```sql
-- 1. Extend permission enum
ALTER TYPE permission ADD VALUE 'can_manage_guest_drinks';

-- 2. Grant to admin role
INSERT INTO role_permissions (role_id, permission)
SELECT r.id, 'can_manage_guest_drinks'
FROM roles r WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- 3. New table (separate from orders to avoid UNIQUE(session_id, user_id) conflicts)
CREATE TABLE guest_orders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  billed_to   UUID        NOT NULL REFERENCES users(id),
  drink_type  TEXT        NOT NULL,
  sugar_level TEXT        NOT NULL,
  guest_label TEXT,                    -- optional cosmetic label e.g. "Alice's friend"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. RLS
ALTER TABLE guest_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read guest orders"
  ON guest_orders FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can insert guest orders"
  ON guest_orders FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN users u ON u.id = ur.user_id
      WHERE u.auth_user_id = auth.uid()
        AND rp.permission = 'can_manage_guest_drinks'
    )
  );

CREATE POLICY "Admins can delete guest orders"
  ON guest_orders FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN users u ON u.id = ur.user_id
      WHERE u.auth_user_id = auth.uid()
        AND rp.permission = 'can_manage_guest_drinks'
    )
  );
```

**Why a separate table:** The `orders` table has `UNIQUE(session_id, user_id)` which powers the upsert pattern and prevents double-orders. Multiple guest drinks can be billed to the same user in one session, so that constraint cannot hold for guest rows. A separate table keeps the existing orders flow completely untouched.

---

## UX Design

The guest drinks UI lives at the **bottom of the OrderForm**, below the user grid and drink selection, only visible to admins (`can_manage_guest_drinks`).

### Visual Layout

```
┌─────────────────────────────────────────────────────┐
│  [existing user grid + drink picker + submit btn]   │
├─────────────────────────────────────────────────────┤
│  👤 Guest Drinks                    (admin only)    │
│                                                     │
│  [When guest orders exist:]                         │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🍵 Tea / Normal  →  Alice    ₹24   [🗑️]    │   │
│  │ ☕ Coffee / Less →  Bob      ₹20   [🗑️]    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [+ Add Guest Drink]  ← toggle button               │
│                                                     │
│  [When expanded:]                                   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Bill to:  [dropdown of active users]       │   │
│  │  Label:    [text input – optional]          │   │
│  │  [same drink type grid as regular orders]   │   │
│  │  [same sugar level buttons]                 │   │
│  │  Price: ₹XX                                 │   │
│  │                                             │   │
│  │  [Add Guest Drink]        [Cancel]          │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Interaction Flow

1. Admin sees a **"👤 Guest Drinks"** section separator below the normal order flow.
2. If any guest drinks exist, they display as compact rows: `[emoji] [Drink] / [Sugar] → [User name]  ₹XX  [🗑️]`. If a `guest_label` was provided, show it instead of "Guest for [Name]".
3. Clicking **"+ Add Guest Drink"** expands the inline form:
   - **Bill to** (required): dropdown of active users
   - **Label** (optional): free text (e.g. "Rahul's friend") — purely cosmetic
   - **Drink type**: reuse the same drink grid buttons already on the form, scoped to `guestDrinkType` state
   - **Sugar level**: reuse the same three sugar buttons, scoped to `guestSugarLevel` state
   - **Price preview**: same `resolvePrice` call shown inline
   - **"Add Guest Drink"**: submits the insert
   - **"Cancel"**: collapses the form, no save
4. On submit: insert into `guest_orders`, reset form state, call `onOrderUpdate()`
5. Clicking 🗑️: shows confirmation modal ("Remove this guest drink?"), then `DELETE` from `guest_orders` by `id`, call `onOrderUpdate()`
6. **Progress ring**: add a secondary label **"+ Y guest drink(s)"** beneath the `X/{total}` ring when `guestOrders.length > 0`

---

## Files to Modify

### 1. `src/App.tsx`

- Add `GuestOrder` interface:
  ```typescript
  interface GuestOrder {
    id: string;
    session_id: string;
    billed_to: string;
    drink_type: string;
    sugar_level: string;
    guest_label?: string;
    created_at: string;
  }
  ```
- Add state: `const [guestOrders, setGuestOrders] = useState<GuestOrder[]>([])`
- In `fetchAllData`: add `supabase.from('guest_orders').select('*').eq('session_id', currentSession.id)` to the existing `Promise.all`, call `setGuestOrders`
- Add a realtime subscription channel for `guest_orders` — same pattern as the existing `ordersListener`, triggers `fetchAllData(session)` on any event
- `handleAbandonSession`: no change needed — `ON DELETE CASCADE` on `guest_orders.session_id` handles cleanup automatically
- Pass `guestOrders={guestOrders}` to `<OrderForm>`

### 2. `src/components/OrderForm.tsx`

- Add `guestOrders: GuestOrder[]` to `OrderFormProps`
- Add local state:
  ```typescript
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [guestBilledTo, setGuestBilledTo] = useState('');
  const [guestDrinkType, setGuestDrinkType] = useState('Tea');
  const [guestSugarLevel, setGuestSugarLevel] = useState('Normal');
  const [guestLabel, setGuestLabel] = useState('');
  ```
- Add `handleAddGuestDrink()`: validate `guestBilledTo` is set, insert into `guest_orders`, reset form, call `onOrderUpdate()`
- Add `handleRemoveGuestOrder(id: string)`: call `showConfirm` then `supabase.from('guest_orders').delete().eq('id', id)`, call `onOrderUpdate()`
- Render guest section below the existing form, gated on `profile?.permissions.includes('can_manage_guest_drinks')`
- Reuse existing `drinks` state (already fetched from DB) and the hardcoded sugar levels for the guest drink picker
- Use existing `showConfirm`/`showError`/`showSuccess` modal helpers for consistency

### 3. `supabase/functions/summarize/index.ts`

In Phase 2 (after `confirm_assignee`, after session update succeeds):

```typescript
// Fetch guest orders for this session
const { data: guestOrders } = await supabase
  .from('guest_orders')
  .select('*')
  .eq('session_id', session_id);
const allGuestOrders = guestOrders || [];

// Attribute cost to billing users
for (const guestOrder of allGuestOrders) {
  await supabase.rpc('increment_drink_count', { user_id: guestOrder.billed_to });
  const price = resolvePrice(guestOrder.drink_type, guestOrder.sugar_level, prices);
  await supabase.rpc('increment_total_cost_consumed', { p_user_id: guestOrder.billed_to, p_amount: price });
}

// Include guest drinks in assignee totals
const totalDrinks = orders.length + allGuestOrders.length;
await supabase.rpc('increment_total_drinks_bought', { p_user_id: assignee.id, p_amount: totalDrinks });

const regularCost = orders.reduce((sum, o) => sum + resolvePrice(o.drink_type, o.sugar_level, prices), 0);
const guestCost = allGuestOrders.reduce((sum, o) => sum + resolvePrice(o.drink_type, o.sugar_level, prices), 0);
await supabase.rpc('increment_total_cost_sponsored', { p_user_id: assignee.id, p_amount: regularCost + guestCost });

// Update total_drinks_in_session on the session record
total_drinks_in_session: orders.length + allGuestOrders.length,
```

**Notes:**
- `last_ordered_drink` / `last_sugar_level` update loop is unchanged — guest orders don't affect the billing user's personal preferences
- Phase 1 (candidate ranking) is unchanged — uses historical totals; guest orders only update those totals at Phase 2 commit time, consistent with how regular orders work

---

## Execution Order

1. Run migration SQL
2. Deploy updated `summarize` edge function
3. Update `App.tsx` (state, fetch, realtime, prop)
4. Update `OrderForm.tsx` (guest UI, handlers)

---

## Verification

1. Start a session as admin
2. Add a guest drink billed to User A — should succeed
3. Add a second guest drink also billed to User A — should succeed (no unique constraint violation)
4. Add a guest drink billed to User B
5. Verify all guest drinks appear in the list with correct drink names, billing user names, and prices
6. Remove one guest drink via 🗑️ and confirm it disappears after the confirmation modal
7. Summarize the session and verify in the database:
   - User A's `drink_count` increased by 2 (their two guest drinks)
   - User A's `total_cost_consumed` increased by the sum of both guest drink prices
   - User B's `drink_count` increased by 1
   - Assignee's `total_drinks_bought` includes all regular + guest drinks
   - `total_drinks_in_session` on the session record includes guest drinks
8. Log in as a non-admin and confirm the "👤 Guest Drinks" section is not visible
