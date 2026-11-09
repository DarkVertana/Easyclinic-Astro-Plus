# Blog admin flow audit and CRUD plan

Date: 2026-11-06. Method: static read of the working tree plus vendor docs. No code was changed, the app was not run, no tests were run, and no paid API was called. All admin code (`src/lib/admin/`, `src/components/admin/`, `src/pages/admin/`) is uncommitted at the time of writing, so line numbers refer to the working tree.

## 1. Owner complaint: opening a published post shows "Draft"

**Cause: reading a post writes to the store.** There is no read-only way to view a post. "Open" creates a working copy, and the list then shows the working copy's state instead of the post's state on the site.

| Step | Where | What happens |
|---|---|---|
| 1 | `src/pages/admin/posts/index.astro:140-143` | A post with no open submission renders its title as a `<form method="post">` to `/admin/api/posts/open/`, not a link. |
| 2 | `src/pages/admin/api/posts/open.ts:11` | The route calls `createFromExisting(slug, user)` unconditionally. |
| 3 | `src/lib/admin/workflow.ts:280-282` | It reads the file from main and calls `fresh(slug, 'edit', parsePost(raw), sha, ...)`. |
| 4 | `workflow.ts:236-237` | `fresh` hardcodes `state: 'draft'`. Frontmatter keeps `status: published`, so the two now disagree. |
| 5 | `workflow.ts:284`, `store.ts:37-38`, `store.ts:53` | The row is persisted with `activeSlug`, taking the unique per-slug lock. |
| 6 | `open.ts:12` | 303 to `/admin/posts/<id>/`. The header shows the state badge as Draft (`posts/[id].astro:82`). |
| 7 | `src/components/admin/data.ts:112-113` | On return to the list, `open` includes that row because `draft` is in `OPEN_STATES` (`data.ts:18`). |
| 8 | `data.ts:134-135` | `submission` found, so the row comes from `fromSubmission` and the Git entry is discarded. |
| 9 | `data.ts:122` | `status: s.state`, so `draft`. Frontmatter `status` is never consulted. |
| 10 | `data.ts:86`, `data.ts:128` | Hint becomes "Unpublished edit of a live post"; Updated becomes now, so the row jumps to the top (`index.astro:37`). |
| 11 | `index.astro:147`, `src/components/admin/ui.ts:18` | `StateBadge` renders "Draft". Tabs move it from Published to Drafts (`index.astro:52-53`). |

### Is the live site affected?

**No, not by opening.** `createFromExisting` calls only `repo.readPost` and `store.putSubmission`. The file on main still says `published`, and production renders from it (`src/lib/content/registry.ts:178`, `src/pages/[...path].astro:13`). `repo.publish` has one caller, `approve` (`workflow.ts:428`). A preview branch is written only on submit (`workflow.ts:337`). The problem is a false label plus admin-side damage.

### Admin-side damage from one click

1. **No way out in the UI.** `reject` allows `draft` (`workflow.ts:464`) but is approver-only (`workflow.ts:461`), and its only form appears when `state === 'pending'` (`approvals/[id].astro:45`, `:163`). `posts/[id].astro` has no discard button. The copy stays until someone submits it and an approver rejects it.
2. **It pins a stale base.** `baseSha` is frozen at the click. If main moves, later submit fails with "Reject this copy" (`workflow.ts:321`), an action an editor cannot perform.
3. **Everyone inherits it.** `activeFor` returns the existing copy to anyone who opens the post (`workflow.ts:278-279`), with the first opener as `createdBy`.
4. **It can falsify freshness.** An untouched copy can be submitted and approved, which sets `lastUpdated` and a new `editorialPass` (`workflow.ts:354-357`) with no content change.

### Related bugs found on the same path

- **Published posts vanish or show the old state until the deploy finishes.** Rows come from this deployment's `getCollection` (`data.ts:110`). A published submission is no longer open, so a new post is in neither source (`data.ts:153-154`), and a published Git draft still reads Draft.
- **Rejected new posts disappear from the list.** The same filter drops them. `reopen` exists in the API (`[action].ts:49`) but no page offers it, while `posts/[id].astro:99` is a dead end.
- **False copy for Git drafts.** Opening one yields `kind: 'edit'`, so it reads "Edit of a live post" (`posts/[id].astro:84`) and "Unpublished edit of a live post" (`data.ts:86`), though it was never live.
- **Keyword lock survives removal.** `keywordConflict` treats the latest `published` submission as owning its keyword (`workflow.ts:91-98`). After an unpublish or delete it would block that keyword forever.
- **Three copies of the active-state list:** `workflow.ts:231`, `store.ts:23`, `data.ts:18`. Adding a state to only one breaks the slug lock.

## 2. The 98 Git drafts are not admin working copies

| | Git draft | Admin working copy |
|---|---|---|
| Lives in | `src/content/posts/<slug>/index.mdx`, `status: draft` | Store row (Neon, or `.admin-data` in dev) |
| Count now | 98 of 154 files (56 published, 0 review) | Whatever has been opened or created |
| Visible to | Preview deployments, noindex (`docs/content-guide.md:80`) | Admin users only |
| Origin | Imported from WordPress, with a row in `migration/posts-manifest.csv` | "New post", "Open", or the AI engine |
| Live effect if removed | None now, but the old URL needs a rule (see 4.3) | None |
| Can sit on a redirect or gone rule | Yes, exact rules (`routes-core.ts:178-188`) | Not applicable |

Both show as "Draft" today, and the numbers disagree. The dashboard tile "Drafts to finish" counts Git only (`data.ts:160`) yet links to `?status=draft`, whose tab counts both (`index.astro:53`). A published post with a working copy is counted as a draft and not as published.

**Rule for the fix:** site status and work state are two separate fields, shown separately, and never merged. See 5.3.

## 3. CRUD gap table

"None" means no code path. "API only" means the server supports it and no page reaches it.

| Action | Today | Verdict | What it must do here |
|---|---|---|---|
| Create | Works: `createSubmission` | OK | Keep. |
| Open / view | POST that writes (`open.ts`) | **Broken** | GET, no write. |
| Edit | Works on a working copy | OK after fix | Copy made on first save, not on open. |
| Save | Full form post with stale check | OK | Records an `edited` event even when nothing changed; make that a no-op. |
| Autosave | Browser `localStorage` only (`shell-client.ts:22-37`) | **Partial** | Server autosave into the working copy, never voiding a pending approval. Keep the local copy as backup. |
| Discard changes | Only clears the browser copy | **None** | `discard`, available to the creator or an approver, no note needed. |
| Duplicate | None | **None** | New slug, `kind: 'new'`, from main or the copy. Clear `editorialPass` and `headKeyword` (the build refuses a shared one). Keep `jobId` so an AI post stays held to its evidence. |
| Unpublish | None | **None** | Commit `status: draft`, plus a rule if chosen. |
| Delete | None | **None** | Atomic commit, see 4.2. |
| Trash, restore | None | **None** | See 4.4. |
| Permanent delete | None; `Store` has no delete method | **None** | Add `deleteSubmission`. Git history still keeps committed content; the UI must say so. |
| Schedule | None | **None** | See 4.5. |
| Update live post | Works, under misleading labels | **Partial** | Rename the action; refuse when nothing changed. |
| Revert | None | **None** | Old content becomes a new edit that goes through approval. Never a direct write. |
| Revisions | Events only, no content; `Submission.content` is overwritten | **None** | Git commits for live posts, store snapshots for working copies. |
| Bulk actions | None | **None** | Per-item results. Bulk approve is forbidden, see 5.4. |
| Slug rename + redirect | None; slug fixed at creation | **None** | Atomic commit, see 4.3. |
| Images | None. Bodies with `![` are refused (`harness.ts:234`, message says screenshots do not exist yet). 0 posts use images or have extra files. | **None** | Needs an owner decision, see 7. Deferred. |
| Reopen rejected | API only | **Broken** | Add the button; keep rejected rows findable. |
| Revert from a stale base | Tells editors to reject | **Broken** | Add "Start again from the current version" plus a field diff of what they would lose. |

## 4. What each risky action has to do in this architecture

### 4.1 Why the Git Data API is required

`repo.publish` uses `PUT /contents` (`repo.ts:101-111`), which writes one file per commit. Deleting a live post needs the file removal and a rule in one commit:

- Rule first: the page and rule coexist, which is a build error (`registry.ts:156-166`, `routes-core.ts:267`, `:276`).
- File first: a window of plain 404s, plus a failure if the second call dies.

**Sequence:** read ref, read commit's tree, verify expected blobs at that commit sha, `POST git/trees` with `base_tree`, `POST git/commits`, `PATCH git/refs/heads/main` with `force: false`.

- A `sha: null` tree entry deletes a path, and errors if the file does not exist. [GitHub trees docs]
- Entries overwrite `base_tree` paths; leaving out `base_tree` would delete everything else. [GitHub trees docs]
- `force: false` "will make sure you're not overwriting work". This is the compare-and-swap. The docs list 422 and 409 without detail, so treat either as "re-read, re-verify, retry once, then conflict". [GitHub refs docs]
- The documented token permission (Contents write) covers blobs, trees, commits and ref updates, so the token in `docs/admin-guide.md:79` is sufficient. [GitHub permissions docs]

**Branch protection was inconclusive:** `gh api .../branches/main/protection` returned 404, which does not distinguish unprotected from no access. The whole design needs direct commits to main; confirm this.

### 4.2 Delete a live post

- Commit together: remove every file in the post folder; add a 410 or a redirect row.
- A 410 and a redirect on one path is itself an error (`routes-core.ts:245-252`), so exactly one is chosen.
- Rows with `to: /<slug>/` would be silently skipped and start returning 404 (`routes-core.ts:293`). Show them and require a new target in the same commit.
- Inbound links: a missing target in frontmatter links is only a warning (`registry.ts:244-249`). That scan covers `record.data`; body-link behaviour was not fully traced. Show the approver the inbound list and have the implementer confirm the output tests.
- Removal from RSS and the sitemap follows automatically from status filtering (`rss.xml.ts:27`, `registry.ts:178`, `:188`).
- Fix `keywordConflict` so a later removal releases the keyword.

**Where rule rows go. Do not write to the existing files:**

- `redirects-posts.yaml` and `gone-posts.yaml` are generated, and CI runs `posts-redirects.ts --check` (`ci.yml:22`). An admin edit would fail CI.
- `redirects.yaml` and `gone.yaml` are hand-written with comments that a re-serialise would destroy.
- **Add `src/data/redirects-admin.yaml` and `src/data/gone-admin.yaml`**, machine-owned. Register them at `content.config.ts:95` and `:108`, and in the readers at `scripts/import-wp.ts:145` and `scripts/posts-triage.ts:238-240`.
- Read rules **from main at the commit's head**, not from the deployment (`workflow.ts:42-55`), which may be behind.
- Run `resolveRules` with the proposed file set before committing. A commit to main that fails the build blocks every later deploy, and CI runs only after the commit lands (`ci.yml:4-6`).

### 4.3 Slug rename, and drafts with legacy URLs

- Live post, in one commit: add the new folder, remove the old, add `old -> new` as a 301.
- New slug must pass `slugConflict` against main's rules.
- **Rename back (A to B to A):** `A -> B` must be removed in the same commit, or A is a page on a rule (build error) and `B -> A` makes a loop (`routes-core.ts:161-163`).
- `collapseRedirects` handles earlier chains (`routes-core.ts:149-169`).
- If the rule blocking a slug is in a hand or generated file, refuse and name the file. The admin only edits its own files.
- **Git draft rename or delete still needs care:** the drafts carry live WordPress URLs. With no rule, cutover gives a 404, which `pnpm coverage --strict` treats as a launch gate (`ci.yml:29-31`). If the slug has a manifest row, require a redirect or 410 choice. A draft on an exact rule is allowed (`routes-core.ts:186-188`).
- Admin-only copies not yet in Git need no rule.

### 4.4 Unpublish, trash, restore

- **Unpublish:** commit `status: draft`. Production stops rendering it and returns 404 unless a rule is added. The rule can be committed alongside, because a draft yields to an exact rule (`routes-core.ts:186-188`). `pageYieldsTo` makes prefix rules invalid.
- **Republish:** normal approval. Any admin rule for that path must be removed in the same commit, or `slugConflict` refuses (`workflow.ts:76-77`) and the build fails.
- **Trash for an admin-only copy:** state `trashed`, no Git action, restorable.
- **A live post cannot be "in trash" and live.** Trash means the delete commit has landed, with the raw file and commit sha kept on the record.
- **Restore is publishing.** Restoring a deleted live post creates a `new` submission through approval, and removes the rule in the same commit. It never commits on click.

### 4.5 Scheduling

**Vercel limits, and the plan matters.** The CLI reports team `mohan-gtihubs-projects` on **hobby**, and `vercel project inspect easyclinic-astro-plus` resolves under it.

| | Hobby | Pro |
|---|---|---|
| Cron Jobs interval | **Once per day**; more frequent expressions fail deployment | Once per minute |
| Cron Jobs precision | ±59 min | Per minute |
| Schedules (public beta) | Every 15 min at best, always 15-min jitter; 5,000 runs per period, then runs are skipped | Every minute, 1-min jitter |
| Function duration | 300 s | 300 s default, up to 800 s |
| Runtime logs | 1 hour | 1 day |

Sources: [Cron usage and pricing], [Schedules limits], [Hobby plan].

- **Hobby is restricted to "non-commercial, personal use only"** [Hobby plan]. This site is a company's. That is a decision for the owner regardless of cron.
- Cron Jobs are documented as legacy, to be migrated to Schedules, which are still beta and "may change" [Cron usage, Schedules limits].
- A 15-minute Hobby Schedule is about 2,900 runs a month, within 5,000 by estimate.

**Requirements from the docs, each needed here** [Manage cron jobs]:

- **Delivery is best effort, with possible duplicates, and no retries.** So the handler reconciles: "publish everything due and unclaimed", with a compare-and-set claim per post.
- **Secret:** `CRON_SECRET` sent as `Authorization: Bearer`. Fail closed if unset; compare in constant time.
- **Redirects are not followed**, and this site uses `trailingSlash: 'always'`. The configured path must end in `/` or the job silently never reaches the function.
- **Production only.** Test by calling the route directly.
- **Registration:** the repo has no `vercel.json`, and routes are written straight into `.vercel/output/config.json`. Confirm a `crons` array appears there after a build; if not, add it in `integrations/vercel-routes.ts`.
- Use the `/admin/api/` prefix, so the middleware applies `no-store` (`src/middleware.ts:9-14`). Cached responses are not logged.
- Persist each run's result in the store, because Hobby logs last one hour.

**Same safety as approve, but with content frozen:**

- The approver reads, answers the editorial questions and picks a time. `approve` then computes the exact file, including `lastUpdated` set to the publish date and `editorialPass`, and stores it with its hash. No commit.
- At fire time the job: claims; recomputes the hash and refuses on mismatch; re-runs `gateChecks` and `slugConflict` on that exact content against main's rules; checks `baseSha`; commits; records.
- **Any failure returns the post to `pending` with a visible reason and voids the approval. It never rebases, retries with changes, or publishes something else.**
- If the approver has since lost approver rights, or the post is more than 7 days overdue, it fails the same way.
- `scheduled` is read-only, holds the slug lock, and cancelling returns it to `pending`.
- UI wording must say "at or shortly after" and state the delay for the current plan.
- Process at most 5 per run, in sequence, as each commit moves the ref.

## 5. Implementation plan

### 5.1 Invariants (each gets a test)

1. Viewing never writes. No GET and no "open" creates a store row.
2. Nothing goes live or leaves the site except through `commitPlan` in `workflow.ts`, reached only from an approval path. Replaces the current single-call-site test.
3. What commits is byte-for-byte what was approved. The approval hash covers the whole plan (files, deletions, rule rows), not only the post body.
4. Every commit is atomic and fast-forward only, with each expected blob verified at the head it builds on.
5. Before commit, the resulting file and rule set passes `resolveRules` and the structural checks using main's data.
6. Site status comes only from Git. Work state comes only from the store. Neither is displayed as the other.
7. Retries never commit twice; a landed commit is detected and recorded.
8. Restore, revert, duplicate and republish all reach the site only through the approval queue.
9. Editors cannot unpublish or delete directly; they can request it. Approvers act with a note and a typed confirmation of the slug.
10. Cron holds no approval power of its own: it only executes an already frozen approval.

### 5.2 Data model (`src/lib/admin/types.ts`)

```ts
export type SubmissionState = 'draft' | 'pending' | 'changes_requested' | 'scheduled' | 'published' | 'rejected' | 'discarded' | 'trashed' | 'removed';

export type LifecycleOp =
  | { type: 'publish' }                    // default; missing on old rows means this
  | { type: 'unpublish'; rule: RouteChoice | null }
  | { type: 'delete'; rule: RouteChoice | null }
  | { type: 'rename'; toSlug: string };

export type RouteChoice = { kind: 'gone' } | { kind: 'redirect'; to: string };

export interface CommitPlan {
  writes: Array<{ path: string; content: string }>;
  deletes: string[];
  expect: Array<{ path: string; sha: string | null }>;
  message: string;
}
```

Add to `Submission`: `op?: LifecycleOp`, `planHash?`, `trashedFrom?: SubmissionState`, `trashedAt?`, `removedRaw?`, `commitSha?`, and:

```ts
scheduled?: { at: string; plan: CommitPlan; planHash: string; approvedBy: string; approvedAt: string };
```

Generalise `publishAttempt` to hold the plan. Add `HistoryAction`s: `discarded`, `trashed`, `restored`, `scheduled`, `schedule_cancelled`, `schedule_failed`, `unpublished`, `deleted`, `renamed`, `reverted`, `autosaved`.

- `ACTIVE_STATES` gains `scheduled`. Export one constant from `types.ts` and use it at all three sites. The slug index needs no migration, as `activeSlug` is computed on write.
- `Store` gains `deleteSubmission(id)`, `putRevision`, `listRevisions`, `listDue(now)`. Revisions use the existing `admin_docs` table with `kind = 'revision'`, capped at 50 per submission, deduped by hash.
- `ContentRepo` gains:
  - `commit(plan): Promise<string>`
  - `listFolder(slug)`
  - `readFile(path)`, for rule files
  - `postHistory(slug)` and `readPostAt(slug, sha)`
- `publish` becomes a wrapper over `commit`, or is removed.

### 5.3 Fix the complaint first (phase 1, independent, smallest)

| File | Change |
|---|---|
| `src/pages/admin/posts/edit/[slug].astro` (new) | GET. Active submission: redirect to it. Otherwise render the editor from `repo.readPost`, with hidden `baseSha`, showing site status. Writes nothing. Share the form by extracting `src/components/admin/PostEditor.astro` from `posts/[id].astro`. |
| `src/pages/admin/api/posts/start-edit.ts` (new) | First save: `startEdit(slug, content, baseSha, user)`. |
| `workflow.ts` | `startEdit`: re-read main; sha differs is a 409 with text kept in the browser; content unchanged creates nothing; otherwise create. On `ActiveSlugError`, refuse with a link to the other copy, **not** the current "both land on it" (`:286-288`), which would lose typed text. Remove `createFromExisting`. Add `discardSubmission`. |
| `workflow.ts` `submitForApproval` | Refuse an `edit` of a **published** post with no content change, ignoring `status` and `lastUpdated`. A Git draft may submit unchanged. Add `sourceStatus` so copy can distinguish them. |
| `posts/index.astro:137-144` | Replace form with `<a>`. |
| `api/posts/open.ts` | Delete. |
| `data.ts` `PostRow` | Replace `status` with `site: 'live' \| 'git_draft' \| 'git_review' \| 'admin_only' \| 'deploying'`, and `work: SubmissionState \| null`. |
| `data.ts` `postRows` | Merge: Git entry gives `site`; open submission gives `work`, never replacing `site`. Latest `published` submission newer than the entry gives `deploying`, fixing the vanishing rows. |
| `posts/index.astro` | Two columns. Tabs: All, Live, Drafts in Git (98), Being edited, Waiting, Sent back, Scheduled, Trash, Out of date. Tabs may overlap, so do not imply they sum. |
| `posts/[id].astro:84`, `data.ts:86`, `workflow.ts:321` | Correct the copy: "Edit of a live post" only when it is live. Stale base offers "Start again from the current version". |
| `posts/[id].astro` | Add Discard and, on rejected posts, Reopen. |
| `admin/index.astro` | "Drafts in Git" and "Being edited" as separate tiles with matching links. |
| Existing rows | `scripts/admin-reap-pristine.ts`: close rows with `kind: 'edit'`, state `draft`, and only a `created` event whose hash equals main's content, as `discarded`. Dry run by default. Only matters for stores that have real data. |

Design note: load the `apple-hig` skill before the UI changes (project memory rule).

### 5.4 Phases after that

**Phase 2: atomic commits**
- `repo.ts`: `commit(plan)` per 4.1; local-mode equivalent for dev. `publish` delegates.
- New `src/lib/admin/routing-edit.ts`: pure `planRules(current, add, remove)` and `validatePlan(plan, mainState)`, which uses `resolveRules`.
- New `redirects-admin.yaml`, `gone-admin.yaml`; register per 4.2.
- `approve`: builds a plan and uses `commitPlan`. Detect a landed retry by comparing every write and deletion against main, replacing `workflow.ts:403`.
- `writePreview` takes the plan, so the preview build tests the same change.

**Phase 3: lifecycle**
- `workflow.ts`: `requestRemoval`, `unpublish`, `deletePost`, `renameSlug`, `trash`, `restore`, `purge`, `duplicate`, `reopen` wired to UI.
- Slug change is a new `rename` op on a submission, with folder listing so all files move.
- `approvals/[id].astro`: show the plan in plain words (files removed, rules added, inbound links, redirects needing a new target), and include `planHash` in the form instead of only `viewedHash`.
- `keywordConflict` fix.
- Add routes to `api/posts/[id]/[action].ts`, with approver checks in `REVIEW_ACTIONS`.

**Phase 4: scheduling**
- `approve` accepts `publishAt`.
- `src/pages/admin/api/cron/publish-scheduled.ts` (GET, no user session, secret check, calls `runDueSchedules(deps)`).
- `cancelSchedule` and a schedule UI. `.env.example` and `docs/admin-guide.md` gain `CRON_SECRET`.
- Trigger depends on the plan decision in section 7.

**Phase 5: revisions and revert**
- Snapshots in `saveEdit`; history panel; field diff using `diffFields` from `review.ts`.
- `postHistory` via `GET /commits?path=`.
- `startRevert(slug, sha)` creates a working copy with old content and **current** `baseSha`.
- Reverting across a rename: list history for the current path only and say so.

**Phase 6: server autosave and bulk**
- Autosave: JSON endpoint with the existing stale check, only in `draft` and `changes_requested`, after first real change, debounced. A conflict stops autosave and shows a notice rather than overwriting.
- Bulk: allowed for discard, trash of admin copies, submit, and set author/topic on existing working copies. Max 25, sequential, per-item result list. Approvers only for removal.
- **Never bulk approve:** approval requires a person reading each post, and answering its editorial questions (`workflow.ts:395-397`).

**Phase 7: images.** Only after the section 7 decision. Blobs through the same plan, inside the approved hash, stored beside the post (`content.config.ts` comment supports that for guides). Require alt text. Enforce type and size limits. Function request-body limits were not checked and must be before design.

### 5.5 Edge cases to test

- Two tabs on the first save, same slug: one creates, one refused with text retained.
- Main moves between view and first save.
- Main moves during `commit`: ref update refused, retried once after re-verify, then conflict.
- Commit lands, response times out: retry sees the plan on main and records it, including for deletion (file absent, rule present).
- Commit lands, store write fails: post stays locked into a retry; for delete, the row must not read as live.
- Delete with a rule when the path is already covered by a hand or generated rule: do not add a duplicate (`routes-core.ts:231`).
- Delete a post that is the `to` of a redirect.
- Rename A to B to A; rename to a slug under a `children` or `prefix` rule.
- Republish after unpublish with a rule.
- Delete a post that was deployed but whose deletion has not deployed: row shows `deploying`, not Live.
- Keystatic or a developer commit to the same post or rule file mid-flow.
- Delete, then create a new post at that slug: refused until the rule is lifted.
- Restoring when the slug has been reused.
- AI post duplicate keeps its evidence check; a missing job blocks it (`workflow.ts:105`).
- Schedule: duplicate delivery; missed run caught up; approver removed; overdue more than 7 days; rule added after approval; token data changes so gates fail; secret missing returns 401; no trailing-slash redirect.
- Frontmatter order preserved through a plan (`store.ts:35`).
- GitHub rate limit in the middle of a multi-post cron run: stop, leave the rest due.
- Post over the 900 KB cap (`workflow.ts:12`): contents-API reads remain limited to 1 MB.

## 6. Tests that encode current behaviour

Read but not run. Line numbers are from `grep` of the working tree.

**Must change**

| Test | Why |
|---|---|
| `tests/e2e/admin.spec.ts:23` | Posts to `/admin/api/posts/open/`, which is removed. Point at `start-edit`; the test requires the route to exist. |
| `admin-workflow.test.ts:98` "repo.publish has exactly one call site" | Must assert on `.commit(` and allow only `commitPlan`. |
| `admin-workflow.test.ts:208-235`, "main changing" (`at submit`, `after submit`, `the way out`) | All use `createFromExisting`. `:233` asserts that opening again returns the same id, and `:227` the "reject the copy" exit. Move to `startEdit` and discard. |
| `admin-workflow.test.ts:246-340`, "partial failures and retries" | Rely on `repo.publish` mock and `publishAttempt.raw`; move to plan-based. Assertions keep their meaning. |
| `admin-workflow.test.ts:118-126` | Asserts `repo.publish.mock.calls[0][3]` for the commit message; moves to `plan.message`. |
| `admin-workflow.test.ts:413` "published and rejected posts refuse the wrong moves" | New states and `reopen` wiring; extend. |
| `admin-core.test.ts:253-308` | Repo tests fake the contents API `PUT`. Rewrite the fake for trees, commits and refs. Keep every conflict case. |
| `admin-core.test.ts:348-352` | Stays if `deletePreview` is unchanged; listed so nobody removes it by accident. |
| Any fixture building `Deps.repo` (`admin-workflow.test.ts:52`, `admin-integration.test.ts:83`) | Needs `commit` and the new read methods. |

**Should still pass unchanged, and are good regression guards**

- `admin-workflow.test.ts:91` editors cannot approve or reject
- `:146` a form cannot set status
- `:156` two approvers
- `:183` old hash cannot pass
- `:343-379` slug and rule collisions
- `admin-integration.test.ts:311-318` slug index
- `tests/output/admin-isolated.test.ts`

No existing test calls `postRows` or asserts `STATE_LABELS` or the "Edit of a live post" copy, so **the reported bug has no test**, which is how it got through. Add:

- A `postRows` unit test with a live post plus a working copy.
- A test that viewing writes nothing.
- A real-browser e2e: view a live post, go back, row still reads Live.

`posts-redirects.test.ts` and `keystatic-config.test.ts` reference routing and manifest data. Re-run them after adding the two YAML files; I did not trace whether they enumerate them.

## 7. Decisions needed from the owner

1. **Vercel plan.** Hobby's terms exclude commercial use, and scheduling on it is coarse. Pro gives per-minute cron. On Hobby, the options are a daily publish window (±59 min) on Cron Jobs, or 15-minute-with-jitter on beta Schedules. **Recommendation: Pro.**
2. **Unpublish default.** Plain 404, or prompt for a 410 or redirect? **Recommendation: prompt, with redirect to the owner landing page preselected.**
3. **Who may delete.** **Recommendation: approvers act directly with a note; editors request.** This means removal has one person's check, not two.
4. **Images.** Are they wanted in posts now? The current rule refuses them because screenshots do not exist. **Recommendation: defer.**
5. **Git draft deletion.** Should an admin be able to delete an imported draft, or is `migration/posts-manifest.csv` still the only route for those? **Recommendation: allow it, requiring a rule choice.** Note the manifest row then disagrees with the repo, so `scripts/posts-manifest.ts` needs checking for overwrites.

## 8. Not verified

- Behaviour was traced by reading, not reproduced in a running admin.
- Branch protection on main (see 4.1).
- Whether `.vercel/project.json`'s `orgId` is exactly the listed Hobby team. The CLI resolved the project under that scope; confirm in the dashboard.
- Whether production has any store rows. Admin code is uncommitted, so phantom rows may exist only in dev.
- Whether `routing-loader` rejects duplicates across files, and body-link handling on delete.

## Sources

- [Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Manage cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Schedules limits](https://vercel.com/docs/schedules/limits)
- [Hobby plan](https://vercel.com/docs/plans/hobby)
- [GitHub trees](https://docs.github.com/en/rest/git/trees)
- [GitHub refs](https://docs.github.com/en/rest/git/refs)
- [GitHub fine-grained token permissions](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
