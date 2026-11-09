# Admin lifecycle and redesign: binding build spec

Sources: admin-cms-flow.md (lifecycle), admin-flow-audit.md (code plan), admin-design-standards.md (design). Where they differ, this file wins.

## Status model
Row = `site` + `work`. Never one field.
- `site` (from Git): `never` (no file), `draft` (file with status draft or review), `live` (published), plus `unpublished` for a post the admin took offline. `trashed` comes from the store.
- `work` (from the store): `none | editing | in_review | changes_requested | scheduled | publishing | failed`.
- Badge shows both: "Published", "Published · Edits in review", "Draft", "Draft · In review", "Scheduled for 12 Nov, 09:00 IST", "Unpublished", "In trash". Never label a live post Draft.
- A Git draft (the 98) with no working copy is "Draft". It is never labelled "Edit of a live post".

## Hard invariants
1. Opening is a GET and writes nothing. A working copy is created by the first save that changes content. No-change save writes nothing and says "No changes".
2. Only `approve`, `publishNow`, the schedule runner, and approved lifecycle operations commit to main. All go through one gated function; a source-grep test enforces this.
3. Exact reviewed content goes live, bound to contentHash. A scheduled post is locked; editing requires unscheduling, which returns it to review.
4. Live traffic keeps the live version until an update is approved.
5. Unpublish, trash of a live post, slug rename and permanent delete are atomic commits (Git Data API, force:false) that include their redirect or 410 row in new `src/data/redirects-admin.yaml` / `gone-admin.yaml` (added to routingLists). Bulk approve is forbidden.
6. Restore never goes live: trash restores to draft, unpublished returns only through review.

## Actions (server enforces role)
| State | Editor | Approver also |
|---|---|---|
| Draft | edit, save, discard changes, submit, duplicate, trash | |
| In review | view, withdraw, duplicate | approve and publish, schedule, send back, reject |
| Changes requested | edit, resubmit, discard | |
| Scheduled | view, duplicate | unschedule, publish now |
| Published | edit, duplicate, view live | unpublish (dialog: 410 or redirect), schedule nothing further |
| Published + edits | edit, compare with live, discard, submit | |
| Unpublished | edit, submit, duplicate | trash |
| Trash | restore if never live | restore any, delete permanently |

Trash: store flag, kept 30 days; a draft-file post's permanent delete is a commit removing the folder. A live post must be unpublished first. Permanent delete and empty-trash need typed confirmation of the slug. Trash has Undo in a banner.

Revisions: each save that changes content appends a snapshot (cap 50) to the submission; history tab lists them, compare with live or a revision, restore into the working copy (not live). Autosave: browser recovery stays; server save is explicit. Slug rename for live posts: goes through review, with a redirect row.

Schedule: approver picks date and time in the approver's zone, shown with IST and UTC. Stored as frozen hash and time. `/admin/api/cron/run-schedules/` authenticated by `CRON_SECRET` bearer, idempotent, re-runs all gates, records failure visibly. `crons` config where the adapter allows; UI states the honest delay from `ADMIN_SCHEDULE_PRECISION` (default "within a day on Hobby"). "Publish now" exists for due items.

Conflict: if main changed under an edit, show compare with both versions and let the editor rebase by choosing; no forced reject.

## Routes (the contract between backend and UI)
GET `/admin/posts/view/?slug=<slug>` opens any post: a read-only view of the Git version when no working copy, otherwise the working copy editor at `/admin/posts/<id>/`. Editor for a live post without a copy renders the fields editable; first POST to `/admin/api/posts/edit/` with `slug` and fields creates the copy.
POST `/admin/api/posts/<id>/<action>/`: save, submit, withdraw, discard, duplicate, approve, schedule (`at` ISO), unschedule, publish-now, request-changes, reject, reopen, restore-revision (`revision`).
POST `/admin/api/posts/lifecycle/` with `slug`, `op` = unpublish | trash | restore | delete | rename | duplicate, `mode` = gone | redirect, `target`, `confirm`, `newSlug`.
POST `/admin/api/posts/bulk/` with `slugs[]` (cap 50), `op` = trash | restore | duplicate | submit | assign-author | set-topic: per-row result reported; never publish.
`postRows()` in `src/components/admin/data.ts` returns `{slug, title, site, work, label, tone, trashed, submissionId, topic, topicLabel, owner, author, authorId, updated, liveUrl, scheduledAt, actions: string[], hint}`; `actions` is what this user may do, computed by one exported `actionsFor(site, work, role)` in `src/lib/admin/lifecycle.ts`.
`activityFeed(limit)` and `pipelineCounts()` in data.ts feed the dashboard.

## Design decisions
- Light 216px rail on surface, no navy. Avatar, role, sign out at bottom.
- Page title Poppins 600; do not synthesize bold on Varela Round. Use it only at its one weight for the wordmark.
- Inputs border `--border-strong` for 3:1. Disabled states use tokens, not opacity.
- Controls 36px visual, 44px hit area. Table 48px rows, 14px text, always-visible row menu, checkbox selection, bulk bar replacing the toolbar in place (two buttons plus More), sortable columns via URL, filter chips over a no-JS GET form, 50 per page, sticky header.
- Tabs: All, Published, With edits, Drafts, In review, Scheduled, Unpublished, Trash, with counts.
- No timed toasts; persistent dismissible banner, Undo where promised. Dialogs (`<dialog>` or popover) for serious actions, danger outlined.
- Editor: title first in a large borderless field, slug below; body Poppins 17/1.7 at 720px measure in a textarea with toolbar; side panel 360px tabs: Ready (checklist grouped, red only after a Submit attempt or blanked field), Details, SEO (with search preview and counts labelled "Title 32 of 60"), FAQs and calls to action, History and revisions. Header: state badge, save status ("Saved 10:42", "Unsaved changes"), Save, outcome-named primary (Submit for approval / Update live post flow), overflow menu.
- Friendly labels everywhere; never leak `headKeyword`, `ctas`, slugs of topics or env var names outside the setup notice.
- Dashboard (role-aware): pipeline bar (Drafts → In review → Scheduled → Published, real counts as links), My work list, content health (no author, no owner page, out of date, owned by /blog/), publishing calendar month view, activity feed from history.
- Review: compare with live, every field labelled, search preview labelled, decision panel with approve, schedule, send back, reject.
- Insights: group the refresh queue by reason, collapsed.
- Add `/admin/calendar/` is part of dashboard only; Trash is a tab, not a separate page.
