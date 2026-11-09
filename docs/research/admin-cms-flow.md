# Admin CMS flow: how the industry does it, and what we should do

Researched 2026-11-06. Bracketed keys link to the sources at the end. "(snippet)" means the fact came from a search result summary of that official page, not a full read of it. "Inference" marks my reasoning. Section 5 lists what could not be verified.

## 1. Why our flow feels wrong

Confirmed in our code:

- **The published post looks like a draft because one field carries two facts.** `postRows` (`src/components/admin/data.ts:133-135`) replaces a published post's row with its open submission, and shows `s.state`. `fresh()` (`src/lib/admin/workflow.ts:234-241`) always starts that submission as `draft`. So the row says "Draft" while the post is still live. Whether the page is live and whether edits are pending need separate fields.
- **Opening is a write.** `createFromExisting` (`workflow.ts:276`, called from `src/pages/admin/api/posts/open.ts`) stores a working copy on open, before any edit.
- **There are no lifecycle actions after publishing.** `SubmissionState` (`src/lib/admin/types.ts:24`) has no scheduled, unpublished or trash state, and no action exists for discard, duplicate, trash, restore, unpublish, or schedule.
- **A changed base dead-ends.** `assertBaseCurrent` (`workflow.ts:321`) tells the editor to reject the copy and reapply their edits by hand.
- **Already good, and to keep:** approval bound to a content hash, stale-write checks, publish lease and retry, and the build-safe gates. Ghost also requires `updated_at` for collision detection on updates [ghost-update].

## 2. Comparison

| | Status model | Published + pending edits | When the working copy appears | Autosave vs save |
|---|---|---|---|---|
| **WordPress** | publish, future, draft, pending, private, trash, auto-draft, inherit [wp-status] | Autosaves never overwrite published content [wp-rev]. Saved edits go live with Update [wp-list]. No built-in pending state on a live post (inference; the Pending box is unavailable once published [wp-side]) | An `auto-draft` row is created for a new post, and cleaned up daily [wp-auto] | One autosave per user per post; plus a browser-local copy [wp-rev] [wp-editor-s] |
| **Ghost** | draft, published and scheduled seen in docs; full list unverified | Unverified | Unverified | Version history kept as you edit [ghost-opts] |
| **Sanity** | Published, draft (`drafts.` path), version [san-drafts] | Yes: draft beside the live document, at most one | On first edit of a published document [san-drafts] | Not documented on the pages read |
| **Contentful** | Draft, Changed, Published, Archived [cf-state-s] | "Changed" is first-class [cf-side-s] | Unverified | Unverified |
| **Strapi** | Draft, Modified, Published [st-dp] | "Modified"; separate Draft (editable) and Published (read-only) tabs [st-dp] | Draft tab always exists | Not documented on the pages read |
| **Payload** | `_status` draft or published; UI shows Draft, Published, Changed [pl-drafts] | Yes: draft save writes only to the versions table; main collection stays live [pl-drafts] | On save | One overwritten autosave version, default 800 ms debounce; Publish is separate [pl-auto] |
| **Directus** | Custom status field [dx-approval-s], plus versioning | Yes: published item read-only; edits go in a version [dx-ver] | Draft version always available; others on Create Version [dx-ver] | Manual save described; autosave not mentioned [dx-ver] |
| **Webflow** | Draft, staged, live, live with changes, scheduled, archived [wf-api] | "Live with unpublished changes" [wf-api] | Unverified | Unverified |
| **Decap** | Draft, In review, Ready [dc-ew] | Published entries being edited get a badge [dc-ew] | Branch and PR on first save [dc-ew] | Save commits |
| **TinaCMS** | Draft field, or branches [tn-drafts] | Branch and PR [tn-ew] | Branch on first Save on a protected branch [tn-ew] | Unverified |
| **Keystatic** | No status documented; branch dropdown [ks-gh] | Branches [ks-gh] | Unverified | Unverified |

| | Trash / restore / delete | Unpublish vs delete | Scheduling | Revisions | Approval and roles | Bulk | List views |
|---|---|---|---|---|---|---|---|
| **WordPress** | Trash on every state, 30 days by default [wp-side]; previous status saved [wp-trash]; restore returns **draft** since 5.6 [wp-untrash] | Status change; trash | `future` [wp-status]; WP-Cron fires on page load, so can run late [wp-cron] | Slider, compare any two, Restore [wp-rev] | Contributor submits only; Author and up publish own [wp-roles] | Edit, Delete; bulk edit status, author [wp-list] | Status tabs, screen options, sortable columns, Quick Edit [wp-list] |
| **Ghost** | Delete is permanent, with confirm; no trash found [ghost-pub] | Unverified in official docs | Schedule for later [ghost-pub] | Restore in post settings [ghost-beta-s] | Contributor drafts only; Author own; Editor all [ghost-roles] | Unverified | Unverified |
| **Sanity** | No archive state [san-archive]; delete recoverable within retention (3, 90, 365 days by plan) [san-archive] | Unpublish removes from site; "Delete is not an archive" [san-archive] | Scheduled drafts on Growth; locked until unscheduled [san-versions] | History and revert; retention by plan [san-hist] | Contributor can't publish [san-roles-s] | Unverified | Structure lists are configured in code [san-struct-s] |
| **Contentful** | Archive advised over delete; delete can't be undone [cf-side-s]; archive only when unpublished [cf-net-s] | Archive is distinct | Publish and unpublish; Scheduled, Completed, Failed tabs [cf-sched-s] | Published versions; roll back [cf-side-s] | Step rules can restrict edit and publish [cf-rules-s]; unresolved tasks block publish [cf-tasks-s] | Publish, unpublish, archive, delete, duplicate; options depend on status [cf-bulk-s] | Saved views [cf-views-s] |
| **Strapi** | Delete in row menu [st-cm]; no trash documented | Unpublish offers keep draft or replace draft; Discard separate [st-dp] | Releases on Growth and up; publishes the **latest draft** at run time; Blocked state [st-rel] | Restore overwrites draft, sets Modified, needs publish; 14-30+ days by plan [st-hist] | Stages with from/to roles; required stage; Enterprise [st-rw] | Bulk publish shows ready or error per entry [st-dp] | Filters, columns, sort; browser or permanent config [st-cm] |
| **Payload** | `deletedAt`; restore; permanent delete; can split trash and purge by role [pl-trash] | Unpublish button [pl-drafts] | `schedulePublish` needs a Job runner [pl-drafts]; on serverless use external cron, never `autoRun` [pl-jobs] | Diffs and restore; 100 per doc by default [pl-ver] | Access control | Unverified | Unverified |
| **Directus** | Archive settings [dx-coll-s]; current trash behaviour unverified | Status change | No native scheduler: cron flow every 15 min with a status and date filter [dx-sched-s] | Compare to previous or latest; Apply restores [dx-ver] | Status plus role permissions recipe [dx-approval-s] | Batch edit, archive disabled in draft mode [dx-explore-s] | Unverified |
| **Webflow** | Delete, archive [wf-help-s] | Unpublish keeps the item editable; `isDraft: true` does **not** unpublish [wf-api]. Archive leaves the site at next full publish [wf-api] | Publish now, Queue, Schedule [wf-help-s] | Site-level backups; no per-item restore found [wf-backup-s] | Unverified by role | Unverified | Unverified |
| **Decap** | Unverified for published entries | Unverified | Not documented in what I read | Git history (inference) | Merge on Approve and publish [dc-ew]; deleting an unpublished entry closes its issue [dc-notes-s] | Unverified | Unpublished entries listed apart; filters don't apply [dc-ew] |
| **TinaCMS** | Unverified | Unverified | Unverified | Git (inference) | Merge the PR in GitHub [tn-ew] | Unverified | Unverified |
| **Keystatic** | Unverified | Unverified | Unverified | Git (inference) | Writers need repo write access [ks-gh-s] | Unverified | Unverified |

**Live URL:** no vendor page I read states the HTTP result of unpublish or delete. Google removes an indexed URL on any 4xx except 429, and treats 404 and 410 the same on the page read [g-4xx]. So a "gone" rule has no documented SEO edge over a 404 there; a redirect is what preserves value when a replacement exists (inference).

**Static or Git sites:** Astro's docs give a draft filter pattern, and nothing found holds back a future date by itself [astro-cc]. Vercel Cron: Hobby daily with hourly precision, Pro per minute [vc-cron]. Vercel Schedules (beta): Hobby every 15 minutes, Pro every minute with jitter [vc-sched]. GitHub Actions: 5-minute minimum, can be delayed or dropped under load [gh-sched]. Deploy hooks allow 60 triggers per hour per project and can be fired by cron [vc-hook].

## 3. The industry standard

1. **Live state and working state are separate.** Sanity, Payload, Strapi, Contentful, Webflow, Directus all show "published with changes" and keep the live version served.
2. **Saving never changes the live page** where a draft layer exists; publish is a separate, explicit action.
3. **Restore never goes live by itself.** Strapi: Modified [st-hist]. WordPress: draft [wp-untrash]. Sanity's trash plugin: draft [san-trash-s].
4. **Unpublish, archive or trash, and permanent delete are distinct.** Ghost is the outlier, with permanent delete. Sanity's own guide warns that delete is not an archive.
5. **Scheduling is a stored date plus a recurring job, with late runs tolerated.** WP-Cron, Directus, Payload all work this way. Good ones surface failure (Contentful Failed tab, Strapi Blocked).
6. **Non-publishers can submit but not publish.** WordPress, Ghost, Sanity share a contributor-type role.
7. **Git-based CMSs map work to a branch and PR created at first save, never on open.**
8. **List filters are status-based and bulk options depend on status.** Bulk publish that reports per-item readiness is the best pattern seen (Strapi).

The working copy timing varies: WordPress creates a throwaway `auto-draft` on new, while Sanity creates a draft on first edit. Autosave is also not universal.

## 4. Recommendation

**Two fields, never merged.** `live`: from Git, `never | live | unpublished`, plus `trashed`. `work`: from the store, `none | editing | in_review | changes_requested | scheduled | publishing | failed`. The badge shows both: "Published · Edits in review".

**Git:** published means the file on main says `status: published`. Never commit `review` status for a live post.

**Working copy:** opening is a read. Create it on the first save that changes the hash. Autosave after 30 seconds idle (our choice), to one overwritten slot per user. Save makes a revision. Neither touches live.

**Transitions**

`none → editing` (first change). `editing → none` (discard). `editing | changes_requested → in_review` (submit). `in_review → changes_requested` (send back). `in_review → none` (reject, note kept). `in_review → publishing` (approve now). `in_review → scheduled` (approve for time). `scheduled → in_review` (unschedule). `scheduled → publishing` (job). `publishing → none`, `live = live`. `publishing → failed → in_review` (retry). `live → unpublished` (approver commit). `unpublished → live` goes through review. `any → trashed`, `trashed → draft` (always).

**Actions**

| State | Editor | Approver adds |
|---|---|---|
| Draft, never live | Edit, save, preview, submit, duplicate, trash | Same |
| In review | View, withdraw, duplicate | Approve, approve for time, send back, reject |
| Changes requested | Edit, resubmit, discard | Same |
| Scheduled | View, duplicate | Unschedule, publish now |
| Published | Edit, duplicate | Unpublish, schedule unpublish, trash |
| Published + edits | Edit, compare, discard, submit | Same as Published |
| Unpublished | Edit, submit, duplicate | Trash |
| Trash | Restore own never-live | Restore any, delete permanently |

**Rules**

- Editing while scheduled is locked, as in Sanity. The approval is bound to the hash, so Strapi's latest-draft approach would break it.
- Scheduling: cron calls the existing publish path, re-running gates and base check. Commit at due time, so main never holds unreleased content. On failure, mark it failed and notify.
- Trashing a live post requires unpublishing first. The dialog asks for the URL outcome: 404 or redirect.
- Trash lasts 30 days. Permanent delete commits file removal; Git retains history.
- Base changed: show a three-way diff, not "reject".

**UI must show**

- Header: live state, working state, live URL, last published, and who has what.
- Buttons named for outcomes: Save, Submit, Update live post, Unpublish.
- Time truth: "Building, live in a few minutes".
- Compare with live, before approval.
- Timezone, and "may go live up to N minutes late" per plan.
- List tabs: All, Published, With edits, Drafts, In review, Scheduled, Unpublished, Trash. Columns: title, state, author, topic, updated, scheduled, published. Row actions by state. Filters in the URL as saved views. Bulk: submit, trash, restore, unpublish, with per-row readiness.

**Decisions for the owner:** Can approvers approve their own work? Which Vercel plan? It sets schedule precision.

## 5. Not verified

- **Rate-limited or blocked:** Contentful's scheduling, state, views and bulk pages returned 429; Webflow's help page returned 403. Those facts are from search snippets, some on old pages.
- **Ghost:** the full status list, unpublish behaviour, and what editing a published post does. Forum posts mention unpublish reverting to draft, but that is not official. Post history comes from an older changelog.
- **WordPress:** the current way to revert a published post to draft; the sidebar docs removed that section in 2024 [wp-side].
- **Live URL behaviour:** not stated by any vendor page read.
- **Webflow API:** its prose and sample disagree on the unpublish method name [wf-api]. Webflow's roles and list views were not found.
- **Directus:** soft-delete notes are from v8 docs, so may be outdated; list presets and bookmarks not found.
- **Keystatic, TinaCMS, Decap:** save-to-commit mapping, delete, scheduling, and list views are mostly undocumented on pages read. "Git history" entries are inference.
- **Vercel Schedules:** beta, limits may change [vc-sched]. Our Vercel plan was not checked.
- **Our code:** I read the transitions and list row, not `approve()` in full, so self-approval is an open question. That unpublished posts return 404 is inferred from `registry.ts:178` and not tested.
- **Product behaviour:** all from docs. No product was run hands-on.

## Sources

[wp-status]: https://wordpress.org/documentation/article/post-status/
[wp-rev]: https://wordpress.org/documentation/article/revisions/
[wp-list]: https://wordpress.org/documentation/article/posts-screen/
[wp-side]: https://wordpress.org/documentation/article/page-post-settings-sidebar/
[wp-auto]: https://developer.wordpress.org/reference/functions/get_default_post_to_edit/
[wp-editor-s]: https://wordpress.org/plugins/disable-gutenberg-autosave/
[wp-trash]: https://developer.wordpress.org/reference/functions/wp_trash_post/
[wp-untrash]: https://developer.wordpress.org/reference/functions/wp_untrash_post/
[wp-cron]: https://developer.wordpress.org/plugins/cron/
[wp-roles]: https://wordpress.org/documentation/article/roles-and-capabilities/
[ghost-update]: https://docs.ghost.org/admin-api/posts/updating-a-post
[ghost-opts]: https://ghost.org/help/publishing-options/
[ghost-pub]: https://ghost.org/help/publishing-content/
[ghost-beta-s]: https://ghost.org/changelog/editor-beta/
[ghost-roles]: https://ghost.org/help/managing-staff-user-profiles/
[san-drafts]: https://www.sanity.io/docs/content-lake/drafts
[san-archive]: https://www.sanity.io/docs/studio/archive-documents
[san-versions]: https://www.sanity.io/docs/content-lake/drafts-and-versions
[san-hist]: https://www.sanity.io/docs/user-guides/history-experience
[san-roles-s]: https://www.sanity.io/docs/user-guides/roles
[san-struct-s]: https://www.sanity.io/docs/studio/structure-builder-introduction
[san-trash-s]: https://www.sanity.io/plugins/trash
[cf-state-s]: https://www.contentful.com/developers/docs/tutorials/general/determine-entry-asset-state/
[cf-side-s]: https://www.contentful.com/help/content-and-entries/entry-editor-sidebar-overview/
[cf-net-s]: https://www.contentful.com/developers/docs/sdks/net/tutorials/management-api/
[cf-sched-s]: https://www.contentful.com/help/scheduled-content-page/
[cf-rules-s]: https://www.contentful.com/help/ai-automations/workflows/workflows-steps-management/workflow-rules-edit-publish-permissions/
[cf-tasks-s]: https://www.contentful.com/developers/docs/references/content-management-api/entry-tasks/
[cf-bulk-s]: https://www.contentful.com/help/content-and-entries/managing-multiple-entries/
[cf-views-s]: https://www.contentful.com/help/content-and-entries/create-content-views/
[st-dp]: https://docs.strapi.io/cms/features/draft-and-publish
[st-rel]: https://docs.strapi.io/cms/features/releases
[st-rw]: https://docs.strapi.io/cms/features/review-workflows
[st-hist]: https://docs.strapi.io/cms/features/content-history
[st-cm]: https://docs.strapi.io/cms/features/content-manager
[pl-drafts]: https://payloadcms.com/docs/versions/drafts
[pl-auto]: https://payloadcms.com/docs/versions/autosave
[pl-ver]: https://payloadcms.com/docs/versions/overview
[pl-trash]: https://payloadcms.com/docs/trash/overview
[pl-jobs]: https://payloadcms.com/docs/jobs-queue/overview
[dx-ver]: https://directus.com/docs/guides/content/content-versioning
[dx-approval-s]: https://docs.directus.io/guides/headless-cms/approval-workflows
[dx-coll-s]: https://docs.directus.io/reference/system/collections
[dx-sched-s]: https://directus.com/docs/tutorials/workflows/schedule-future-content-with-directus-automate
[dx-explore-s]: https://docs.directus.io/user-guide/content-module/content.html
[wf-api]: https://developers.webflow.com/data/docs/working-with-the-cms/publishing
[wf-help-s]: https://help.webflow.com/hc/en-us/articles/33961230697107-Save-and-publish-Collection-items
[wf-backup-s]: https://help.webflow.com/hc/en-us/articles/33961244069395-Save-and-restore-backups
[dc-ew]: https://decapcms.org/docs/editorial-workflows/
[dc-notes-s]: https://decapcms.org/docs/notes/
[tn-drafts]: https://tina.io/docs/drafts/overview
[tn-ew]: https://tina.io/docs/tinacloud/editorial-workflow
[ks-gh]: https://keystatic.com/docs/github-mode
[ks-gh-s]: https://keystatic.com/docs/github-mode
[g-4xx]: https://developers.google.com/search/docs/crawling-indexing/http-network-errors
[astro-cc]: https://docs.astro.build/en/guides/content-collections/
[vc-cron]: https://vercel.com/docs/cron-jobs/usage-and-pricing
[vc-sched]: https://vercel.com/docs/schedules/limits
[gh-sched]: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
[vc-hook]: https://vercel.com/docs/deploy-hooks
