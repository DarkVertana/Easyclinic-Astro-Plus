# Blog admin guide

## What it is

The admin at `/admin/` is where the team writes, checks, approves and publishes blog posts without touching code. Google sign-in controls who gets in. It can also draft a post with AI from sources it has checked, and shows how each post is doing.

Published posts always live in the website's code repository. The admin only keeps work in progress: drafts, approvals, AI jobs and history. Visitors never see the admin. It is not in search results or the sitemap.

## Day to day

1. **Write or generate.** Start a new post, open an existing one, or give the AI a topic. The AI stops and asks a person to approve its outline before it writes.
2. **Check.** Automatic checks run on the post. Errors must be fixed; warnings are for your judgement. Use the preview to see the page as a visitor would.
3. **Submit.** The post goes into the approvals queue. It stays private.
4. **Approve.** An approver reads it, then approves, sends it back with a note, or rejects it. If the post changed after they opened it, the approval does not go through, and they read the new version first.
5. **Live after the build.** Approval saves the post to the repository, and the site rebuilds. The post is live when that build finishes, usually a few minutes later, not the moment you approve.

### Which post next

The Insights page lists published posts, most demo requests first, then a refresh queue of what to work on and why: search clicks down 30% or more, not updated in a year, no landing page owner, or still a draft.

How to read the numbers:

- **Demo requests** count visits that started on the post and ended with a demo request. A reader who came in elsewhere and read the post along the way is not counted, so treat this as a minimum.
- **Search numbers** run two or three days behind. The page shows the dates it covers.
- **"New"** means there was nothing in the previous 28 days to compare with. A dash means no figure is available.

## Roles

| | Editor | Approver |
| --- | --- | --- |
| Write and edit drafts | Yes | Yes |
| Generate with AI | Yes | Yes |
| Submit for approval | Yes | Yes |
| Approve, send back or reject | No | Yes |

Anyone not on either list cannot sign in.

## What the AI can and cannot do

**It can:** look for sources, read them, pull out claims with exact quotes, propose an outline, write a draft from those claims, and review its own draft for facts and style.

**It cannot:** publish, approve, or skip the checks. It cannot use a claim whose quote was not found in the source: the code tests this, and refused claims are shown to the reviewer. It cannot choose where a post's buttons go: the main button goes to the demo page for the brief's country and the second to the owner page. Only a person can type an outside address there, and the approver sees it marked as an external link.

Limits on spending:

- Each job makes at most two rounds of revisions and allows three retries after a failure.
- Each job stops at a dollar limit, and all AI use stops at a weekly dollar limit. A step already running can finish its current call, so spending can pass a limit slightly.
- Topic ideas count as one run in the weekly limit, and their cost counts too.
- If a step stops without finishing, the job page waits for someone to press the button. After a second such stop, the job fails and needs a retry.

A person is still responsible for every published word. Its review is advice, not proof. Open the sources for anything that matters, especially numbers, and legal or medical statements.

**Facts in AI drafts.** A post that began as an AI draft stays held to that job's evidence at submit and approve, including text a person added later. A number or outside link that is not in the job's sources or the confirmed facts blocks it. Remove it, or reword using a sourced figure. To publish a fact from elsewhere, write the post as a new, non-AI post. There is no override.

## What blocks submitting and approving

The same checks that would stop the site build run first, so one approved post cannot stop a deploy. These include: a head keyword already used by a published page (capitals ignored), a `{fact:...}` style token that does not exist or has no confirmed value, a title or description too long once tokens are filled in, and a body that does not compile.

The approval page shows every field that will be published, and marks external links.

## Try it on your own computer

Run `corepack pnpm dev`, then open `http://localhost:4321/admin/login/`. Local settings go in `.env.local`, which is never committed. Work is kept in local files, even if `DATABASE_URL` or `GITHUB_TOKEN` are set, because the development sign-in has no password. To test against the real database or repository, set `ADMIN_DEV_ALLOW_REAL=1`. That turns off the development sign-in, so you also need the Google sign-in settings.

## Setup

Set these in the Vercel project under Settings, then Environment Variables, and redeploy. All of them are private to the server. `.env.example` has the same list.

### Sign-in

- [ ] **`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.** In Google Cloud Console, open APIs and Services, then Credentials, and create an OAuth client of type "Web application". Add each address people use as an authorised redirect URI, with the final slash: `https://www.easyclinic.io/admin/auth/callback/`, plus `http://localhost:4321/admin/auth/callback/` for local trials.
- [ ] **`ADMIN_APPROVERS`.** Email addresses of people who may publish, separated by commas.
- [ ] **`ADMIN_EDITORS`.** Email addresses of people who may write and submit, separated by commas.
- [ ] **`ADMIN_SESSION_SECRET`.** Signs the sign-in cookie. Create one with `openssl rand -base64 32`. Changing it signs everyone out.

### Supabase (storage, publishing and sign-in)

When `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set, Supabase replaces Neon, GitHub and the env account:

- **Work in progress** (drafts, schedules, AI jobs) is in the `admin_docs` table.
- **Published content** is in the private Storage bucket `content`, at the same paths as in the repository. `pnpm build` runs `node scripts/content-sync.ts pull` first, which mirrors the bucket into the working tree, so blog pages stay static. Publishing uploads to the bucket and calls `VERCEL_DEPLOY_HOOK_URL`; the post is live when that build finishes.
- **Sign-in** checks Supabase Auth. Add or remove people in the Supabase dashboard under Authentication, then Users. A removed user's open session lasts until it expires (12 hours) or `ADMIN_SESSION_SECRET` changes.
- **Schema** is in `supabase/migrations/`. Apply it with `npx supabase db push --db-url "<connection string>"`.
- **First copy** of the posts: `node scripts/content-sync.ts push` uploads the files in Git. After that, Supabase is the source of truth and the files in Git are only a fallback when Supabase is not set up.

Set in Vercel: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `VERCEL_DEPLOY_HOOK_URL`, `ADMIN_SESSION_SECRET`. These are needed at build time too, for the pull.

### Storage and publishing without Supabase (legacy)

- [ ] **`DATABASE_URL`.** The connection string from your Neon project's dashboard. Holds drafts, approvals and AI jobs.
- [ ] **`GITHUB_TOKEN`.** On GitHub, create a fine-grained personal access token. Choose this repository only, and give it Contents: read and write, nothing else. Note its expiry date: when it expires, publishing stops until you replace it.
- [ ] **`ADMIN_GITHUB_REPO`.** The repository as `owner/name`.
- [ ] **`ADMIN_PREVIEW_URL_TEMPLATE`.** The address pattern of a preview deployment for a post's branch, so reviewers get a working preview link. Write `{branch}` and `{slug}` where those belong, for example `https://your-project-git-{branch}.vercel.app/{slug}/`. Each submission has its own branch, named `content/<slug>-<short id>`, and `{branch}` is filled in as `content-<slug>-<short id>`. Check the real address on one Vercel preview first, because Vercel may shorten or alter long branch names.

### AI drafting

- [ ] **`ANTHROPIC_API_KEY`.** From the Anthropic Console. Without it, generating is off and everything else works.
- [ ] **`ADMIN_WEEKLY_AI_LIMIT`.** The most AI runs allowed in a week, which keeps spending predictable. Drafts and topic ideas both count.
- [ ] **`ADMIN_JOB_MAX_USD`.** Dollar limit for one job. Default 5.
- [ ] **`ADMIN_WEEKLY_MAX_USD`.** Dollar limit for all AI use in a week. Default 50.

### Analytics, for the Insights page

The refresh queue works without these. Any one source can be connected alone.

- [ ] **`GOOGLE_SERVICE_ACCOUNT_JSON`.** In Google Cloud, enable the "Google Analytics Data API" and the "Google Search Console API". Create a service account, add a JSON key, and paste the whole file as the value. Treat it like a password.
- [ ] **`GA4_PROPERTY_ID`.** The numeric property ID, from Analytics under Admin, then Property details. In Analytics, under Admin, then Property access management, add the service account's email (`client_email` in the key file) as a Viewer.
- [ ] **`SEARCH_CONSOLE_SITE`.** The property exactly as Search Console shows it: `sc-domain:easyclinic.io` for a domain property, or `https://www.easyclinic.io/` with the final slash for a URL-prefix one. In Search Console, under Settings, then Users and permissions, add the same email with Restricted permission.

If the page shows a message about the service account, its key was probably deleted or disabled: create a new key and replace the value. A message about access means the email was removed from that property. New Search Console properties can take up to a week to show data.

## Post lifecycle

A post has two facts, shown together and never merged. Binding rules: `docs/research/admin-build-spec.md`. Code: `src/lib/admin/lifecycle.ts`.

- **Site** comes from Git: not on the site, draft, published, or unpublished (the store remembers an admin took it offline).
- **Work** comes from the store: none, editing, in review, changes requested, scheduled, publishing, failed.

Opening a post writes nothing. The working copy starts at the first save that changes content; a save with no change says "No changes" and writes nothing.

**What reaches main.** Approve, publish now, the schedule runner, unpublish and permanent delete, all through `commitPlan` in `workflow.ts`. Each is one atomic commit using the Git Data API (`force: false`), which holds the post change and any rule row together. Before committing, the resulting rules go through the same `resolveRules` the build runs.

**Rule files.** The admin writes only `src/data/redirects-admin.yaml` and `src/data/gone-admin.yaml`. Do not edit them by hand. If a hand-written or generated row is in the way, the admin refuses and names the file for a developer to change.

**Unpublish, trash, delete.** A published post must be unpublished first (choose 410 or redirect), then trashed, then deleted by typing its address. Restore never puts anything live. Trash is a store flag. After 30 days, the schedule runner removes copies that never reached Git; a file on main stays until someone deletes it, because that needs a commit and a person. Git history keeps committed text after a delete.

**Rename.** Goes through review. Approval commits the move and a 301 together. A post with other files in its folder is refused.

**Scheduling.** The approver reads the post, answers the questions and picks a time, which freezes the exact file and its hash. Nothing reaches main until the time comes. At that point the runner re-runs every gate. Any failure returns the post to review with the reason shown, and it needs a fresh approval. It never rebases or publishes something else. More than 7 days overdue counts as a failure.

Set `CRON_SECRET` in Vercel; without it the route refuses every call. The build writes a daily job to `.vercel/output/config.json` at 03:00 UTC, the most Hobby allows. `ADMIN_SCHEDULE_PRECISION` is the delay the dialog states, default "within a day on Hobby". Change it, and the cron line in `integrations/vercel-routes.ts`, if the plan changes. To test, call `/admin/api/cron/run-schedules/` with `Authorization: Bearer <secret>`; Vercel runs cron on production only.
