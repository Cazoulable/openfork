# Messaging Slack-Style Layout Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the messaging module from page-based navigation to a Slack-style three-panel layout (channel sidebar | chat | thread panel).

**Architecture:** Replace separate ChannelsPage/DmListPage/ChannelDetailPage/DmDetailPage page routes with a single `MessagingLayout` component that renders: (1) a left sidebar with collapsible "Channels" and "Direct Messages" sections, (2) a centered search bar at top, (3) the active chat view via `<Outlet />`, (4) an optional thread panel on the right. Also fix backend message ordering (DESC → ASC) so older messages appear at top, and ensure auto-scroll to bottom on channel open.

**Tech Stack:** React, React Router, TypeScript, Tailwind CSS, Rust/SQLx (backend fix)

---

### Task 1: Fix Backend Message Ordering

**Files:**
- Modify: `modules/messaging/src/handlers/messages.rs:54`
- Modify: `modules/messaging/src/handlers/dm.rs:111`

**Step 1: Fix channel messages ordering**

In `messages.rs:54`, change:
```sql
ORDER BY created_at DESC
```
to:
```sql
ORDER BY created_at ASC
```

**Step 2: Fix DM messages ordering**

In `dm.rs:111`, change:
```sql
ORDER BY created_at DESC
```
to:
```sql
ORDER BY created_at ASC
```

**Step 3: Verify**

Run: `cargo check -p messaging`

**Step 4: Commit**

```bash
git add modules/messaging/src/handlers/messages.rs modules/messaging/src/handlers/dm.rs
git commit -m "fix: order messages chronologically (oldest first)"
```

---

### Task 2: Create MessagingLayout Component

**Files:**
- Create: `frontend/src/components/messaging/MessagingLayout.tsx`

This is the core new component. It renders:
- A top bar spanning the full width with a centered search input
- A left sidebar (~240px) with:
  - Collapsible "Channels" section with channel list items (# icon, name, active highlight)
  - "+" button on section header to create new channel
  - Collapsible "Direct Messages" section with DM group items
  - "+" button on section header to create new DM
- A main content area using `<Outlet />` to render ChannelDetailPage or DmDetailPage
- Empty state when no channel/DM is selected

The search bar searches channels by name, DM groups, and message content (using existing `searchMessages` API).

**Step 1: Write MessagingLayout**

The component:
- Fetches channels via `api.listChannels(workspaceId)` and DM groups via `api.listDmGroups()`
- Uses `useParams` to determine active item and highlight it
- Uses `useNavigate` to handle clicks on sidebar items
- Passes channel/DM lists down via Outlet context so detail pages can refresh them
- Sections are collapsible with chevron toggle

**Step 2: Move NewChannelModal and NewDmModal**

Extract `NewChannelModal` from `ChannelsPage.tsx` and `NewDmModal` from `DmListPage.tsx` into the MessagingLayout (they're triggered by "+" buttons in sidebar section headers).

**Step 3: Commit**

```bash
git add frontend/src/components/messaging/MessagingLayout.tsx
git commit -m "feat: add MessagingLayout with Slack-style channel/DM sidebar"
```

---

### Task 3: Refactor ChannelDetailPage for Embedded Use

**Files:**
- Modify: `frontend/src/components/messaging/ChannelDetailPage.tsx`

**Step 1: Remove TopBar and standalone navigation**

- Remove the `<TopBar>` wrapper (the layout now provides the header)
- Remove imports for TopBar
- Keep channel header info (name, description) inline within the chat area
- Keep all message functionality (reactions, threads, edit/delete, send)
- Channel actions (edit, leave, delete) move to a header row inside the chat area
- On delete/leave, navigate to `/${slug}/channels` (the layout will show empty state)

**Step 2: Ensure auto-scroll to bottom on mount**

The existing auto-scroll logic should work but verify `shouldAutoScroll` starts as `true` and fires on initial message load.

**Step 3: Commit**

```bash
git add frontend/src/components/messaging/ChannelDetailPage.tsx
git commit -m "refactor: adapt ChannelDetailPage for embedded use in MessagingLayout"
```

---

### Task 4: Refactor DmDetailPage for Embedded Use

**Files:**
- Modify: `frontend/src/components/messaging/DmDetailPage.tsx`

**Step 1: Remove TopBar and back button**

- Remove TopBar, ArrowLeft import, back button
- Keep all DM message functionality
- Keep conversation header inline

**Step 2: Commit**

```bash
git add frontend/src/components/messaging/DmDetailPage.tsx
git commit -m "refactor: adapt DmDetailPage for embedded use in MessagingLayout"
```

---

### Task 5: Update Routing in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Update routes**

Replace:
```tsx
<Route path="channels" element={<ChannelsPage />} />
<Route path="channels/:id" element={<ChannelDetailPage />} />
<Route path="dm" element={<DmListPage />} />
<Route path="dm/:id" element={<DmDetailPage />} />
```

With:
```tsx
<Route path="channels" element={<MessagingLayout />}>
  <Route index element={null} />
  <Route path=":id" element={<ChannelDetailPage />} />
</Route>
<Route path="dm" element={<MessagingLayout />}>
  <Route index element={null} />
  <Route path=":id" element={<DmDetailPage />} />
</Route>
```

Both `channels` and `dm` base routes render MessagingLayout. The index routes render nothing (layout shows "select a conversation" empty state). Detail routes render inside the layout's Outlet.

**Step 2: Remove unused imports**

Remove `ChannelsPage` and `DmListPage` imports from App.tsx (their functionality is now in MessagingLayout).

**Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "refactor: update routing to use MessagingLayout for messaging module"
```

---

### Task 6: Clean Up Unused Files

**Files:**
- Delete or keep: `frontend/src/components/messaging/ChannelsPage.tsx`
- Delete or keep: `frontend/src/components/messaging/DmListPage.tsx`

These pages are no longer routed to. Their modal components were moved to MessagingLayout. Delete them if fully unused, or keep if referenced elsewhere.

**Step 1: Verify no remaining imports**

Search for imports of ChannelsPage and DmListPage across the codebase.

**Step 2: Delete if unused**

```bash
rm frontend/src/components/messaging/ChannelsPage.tsx frontend/src/components/messaging/DmListPage.tsx
```

**Step 3: Commit**

```bash
git commit -m "chore: remove unused ChannelsPage and DmListPage"
```

---

### Task 7: Verify & Test

**Step 1: Build frontend**

Run: `cd frontend && npm run build`
Expected: No TypeScript errors

**Step 2: Build backend**

Run: `cargo check`
Expected: No Rust errors

**Step 3: Manual verification checklist**

- [ ] Clicking "Chat" in main sidebar shows MessagingLayout with channel/DM sidebar
- [ ] Clicking a channel shows messages in chronological order (oldest at top)
- [ ] Chat auto-scrolls to bottom on open
- [ ] Can switch channels without leaving the view
- [ ] Collapsible sections work (Channels / Direct Messages)
- [ ] "+" buttons open create modals
- [ ] Thread panel opens on the right
- [ ] Search bar filters channels and searches messages
- [ ] DM conversations work the same way
- [ ] Channel actions (edit, leave, delete) still work
