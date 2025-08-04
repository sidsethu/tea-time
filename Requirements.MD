Here's a **comprehensive product + system requirements document** to build the app using **Vercel (frontend) and Supabase (backend)**. This document assumes no prior context.

---

# ☕ Tea Time Rotation App — Specification Document

### 📌 Summary

This is a lightweight web app designed to help a group of colleagues collaboratively manage daily tea/coffee orders. The system ensures fairness in choosing who collects the order each round and streamlines order collection in real-time. It should work well across mobile and desktop browsers.

---

## 🧩 Core Concepts

* **One person starts the session**
* **Everyone joins and submits their order**
* **Once everyone is done, someone ends the session**
* **App automatically picks the assignee (order collector) based on fair rotation**
* **Summarizes the order**

---

## 🖼️ App Flow Overview

### ✅ 1. **Landing State**

* If no session is active:

  * Show a button: `Start Tea Time`
* When any one user clicks it:

  * A **new active session is created** in the backend (Supabase)
  * All users who visit the app after this will **see the active session UI** instead of the "Start" button

---

### ✅ 2. **Active Session (Order Collection State)**

All users now see:

* A dropdown to select **their name** from a master list
* Drink selection:

  * Drink Type (e.g., Tea, Coffee, Badam Milk)
  * Sugar Preference (Normal, Less, No Sugar)
* Submit button

When a user submits:

* Their name is **locked** (cannot be reused by another user)
* Show: `Already submitted by [Name]` if attempted again
* Allow them to **edit or re-submit** their order if they reopen the app before the session is summarized

Also:

* Show a **counter of submissions** (e.g., "4 people submitted")

---

### ✅ 3. **Summarize Tea Time**

When at least one person has submitted:

* All submitters can see the `Summarize Tea Time` button
* Clicking this:

  * Triggers a confirmation modal:
    *“Are you sure? This will finalize the session for everyone.”*
  * On confirmation:

    * The session is **marked as complete**
    * The app performs **fair rotation logic** to choose the person who should get the order
    * A final order summary is generated and shown to everyone

---

### ✅ 4. **Final Summary Screen**

* Display:

  * 🎯 `It’s [X]'s turn to get the tea!`
  * 🧾 Order Summary (e.g., 2 Tea, 1 Coffee, etc.)
  * 🔽 Expandable section showing detailed breakdown:

    * Alice → Tea, No Sugar
    * Bob → Coffee, Less Sugar

---

## 🔄 Fair Rotation Logic

* Use a **Least Recently Assigned (LRU)** method
* For every user, store their `last_assigned_at` timestamp
* Among users who submitted in this round, pick the one with the **oldest `last_assigned_at`**
* Update that user’s timestamp after assignment

---

## 🧠 State Model

Use Supabase tables to store and sync the app state.

### 1. **users**

| Field              | Type      | Description                                  |
| ------------------ | --------- | -------------------------------------------- |
| id                 | UUID      | Unique user ID                               |
| name               | Text      | Full name                                    |
| last\_assigned\_at | Timestamp | Last time they were selected as order person |

### 2. **sessions**

| Field       | Type                         | Description              |
| ----------- | ---------------------------- | ------------------------ |
| id          | UUID                         | Session ID               |
| started\_at | Timestamp                    | Time session began       |
| ended\_at   | Timestamp (nullable)         | Time session ended       |
| status      | Enum ("active", "completed") | Session lifecycle status |

### 3. **orders**

| Field        | Type                  | Description            |
| ------------ | --------------------- | ---------------------- |
| id           | UUID                  | Order ID               |
| session\_id  | UUID (FK to sessions) | Associated session     |
| user\_id     | UUID (FK to users)    | Person placing order   |
| drink\_type  | Text                  | e.g., Tea, Coffee      |
| sugar\_level | Text                  | e.g., Normal, Less, No |
| created\_at  | Timestamp             | Order time             |

---

## 🔐 Supabase Features to Use

* **Row-level security**: Optional, for guarding data
* **Realtime subscriptions (`onSnapshot` equivalent)**: Sync UI when:

  * A new order is submitted
  * A session is started or summarized

---

## ⚠️ Edge Case Handling

| Case                                             | Handling                                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Duplicate name submission                        | Disable names that are already submitted                                                 |
| User forgets to submit                           | Show visible “X of Y submitted” count                                                    |
| Two people click "Start Tea Time" simultaneously | Use a Supabase function or transaction to ensure only one session is active              |
| Two people click "Summarize" at the same time    | Only first confirmed action is processed (lock with transaction or `is_completed` check) |
| Session abandoned                                | Add a timer (e.g., auto-expire after 15 mins of inactivity)                              |

---

## 🔧 Technical Stack

| Component  | Tech                                               |                        |
| ---------- | -------------------------------------------------- | ---------------------- |
| Frontend   | React + TailwindCSS                                |                        |
| Backend    | Supabase (PostgreSQL, Auth, Realtime)              |                        |
| Hosting    | Vercel                                             |                        |
| State Sync | Supabase Realtime (via `useEffect` + \`on('INSERT' | 'UPDATE')\` listeners) |

---

## 📚 Optional Enhancements

* “Excuse me today” toggle → skips a person from assignee selection
* Display past 5 tea sessions (`/history` page)
* PWA setup for mobile app-like feel
* LocalStorage to remember user's default name

---

## 📦 Deliverables

* Responsive web app deployed on Vercel
* Supabase database and functions set up
* UI States:

  * Before tea time
  * During tea time (submit state)
  * Summary screen
  * View history (optional)
* Real-time updates for all participants
* Fair, auditable assignment of tea collector

---