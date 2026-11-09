# Blog admin core: edge cases

Research for `src/lib/admin/` (auth, store, repo, workflow). Sources were read on 6 November 2026.

Status:

- **Tested**: a unit test in `tests/unit/admin-core.test.ts` or `admin-workflow.test.ts` covers it, using fakes for GitHub, Google and the database.
- **Smoke**: also run once against a local `astro dev` server.
- **Handled, untested**: the code deals with it, but no test exercises it.
- **Open**: not solved. Needs a decision or a live check.

No test has run against real GitHub, Google, Neon or Vercel. The fakes copy what the docs say, so anything the docs leave out is listed under "What the docs do not settle".

## Sources

| Ref | URL |
|---|---|
| G | https://developers.google.com/identity/openid-connect/openid-connect |
| H1 | https://docs.github.com/en/rest/repos/contents |
| H2 | https://docs.github.com/en/rest/git/refs |
| H3 | https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api |
| N | https://neon.com/docs/serverless/serverless-driver |
| P | https://www.postgresql.org/docs/current/transaction-iso.html |
| A1 | https://docs.astro.build/en/reference/configuration-reference/ |
| A2 | https://docs.astro.build/en/reference/api-reference/ |

## External facts the design relies on

- A token received directly from Google's token endpoint can be trusted without a signature check. A token passed to any other component must be validated (G). `validateClaims` is only called from `exchangeCode`.
- `iss` is `https://accounts.google.com` or `accounts.google.com`. `aud` must equal the client ID, and `exp` must not have passed (G).
- State must be confirmed on return, and the nonce is presented once for replay protection (G).
- Google recommends `sub` as the stable identifier, because an email address can change (G). We allow by email because the owner's lists are emails. See case 25.
- `PUT contents` needs the blob `sha` when updating. Parallel PUT and DELETE calls conflict, so they must run one after another (H1). This is why one 409 can mean only that the branch moved.
- Contents API: all features up to 1 MB; from 1 to 100 MB only the raw or object media types (H1). This is why posts are capped at 900 KB.
- `POST git/refs` lists 201, 409 and 422. `PATCH` takes `force`. `DELETE` lists 204, 409 and 422. `GET` on a missing ref returns 404 (H2).
- Limits: 5,000 requests an hour, 80 content-creating requests a minute. Over the limit returns 403 or 429. Honour `retry-after`; if `x-ratelimit-remaining` is 0, wait for `x-ratelimit-reset`; otherwise wait at least a minute. Continuing while limited can get the integration banned (H3). So there is no automatic retry.
- Use `neon()` over HTTP for single statements, and `sql.query(text, params)` for manual parameters (N). The claim needs only one statement, so no Pool or interactive transaction is required.
- In Read Committed, an UPDATE that finds its row being changed by another transaction waits, then re-evaluates its WHERE clause on the new row version, and skips the row if it no longer matches (P). This is what makes `WHERE data->>'updatedAt' = $3` safe.
- `checkOrigin` defaults to true, but only checks no content type, form-encoded, multipart and plain text (A1). `assertSameOrigin` also covers other content types.
- `X-Forwarded-Host` is ignored unless `security.allowedDomains` is set (A1). So `url.origin` should not be spoofable that way.
- `context.url` is normalized and its pathname may be partly decoded (A2). `safeBack` therefore parses the value itself.

## What the docs do not settle

- **What 409 and 422 mean on `PUT contents`.** H1 only labels them "Conflict" and "Validation failed". We treat a 409, or a 422 mentioning `sha`, as a conflict after re-reading the file. Any other 422 is a plain refusal. A stale sha returning 409 comes from a third-party write-up (https://dev.to/najmulcodes/github-contents-api-cms-in-nextjs-publish-markdown-without-a-database-4oge), which marks the missing-sha 422 as unverified.
- **What `POST git/refs` returns when the branch exists.** H2 does not say. We treat both 409 and 422 as "may exist" and then PATCH, and a real refusal fails at the PATCH.
- **Whether Astro handles a thrown Response.** A2 is silent. The smoke test shows it does **not**: see case 24.
- **Whether a reused Google code has a defined error.** G does not say. Any non-OK exchange is treated as a failed sign-in.

## Cases

### Concurrency

| # | Case | Behaviour | Status |
|---|---|---|---|
| 1 | Two approvers act at once | Each must write a claim conditional on the `updatedAt` it read. One passes. The other gets 409 and never reaches `repo.publish`. | Tested; removing the check fails the test |
| 2 | Second approver, send-back or reject during a publish | Refused by the lock while the lease is live. | Tested |
| 3 | Edit racing an approval | Pending posts refuse edits. A post sent back, edited and resubmitted has a new hash, so the old `viewedHash` is refused. | Tested |
| 4 | Two editors save from one version | The second gets 409, and the first save stands. | Tested |
| 5 | Two writes in one millisecond | `stamp` always moves forward, so the stale check still sees a change. | Tested |
| 6 | Atomicity in real Postgres | The check is inside one UPDATE statement (P). | Tested against a fake only: SQL text and parameters. **Open** until run on Neon |
| 7 | Two people create the same slug at the same moment | The active-slug check is a read then a write, so two drafts can exist. The second to publish loses at `baseSha` or the file-exists check, so main is safe. | Sequential case tested; the true race is handled, untested |

### Main and the repository

| # | Case | Behaviour | Status |
|---|---|---|---|
| 8 | Main changed before submit | Refused before any branch is written. | Tested |
| 9 | Main changed after submit | `publish` refuses, the post stays pending, `publish_failed` is recorded, and main is untouched. | Tested |
| 10 | Getting out of a conflict | Reject the stale copy, then open the post again from the new main. There is no merge screen, so the editor reapplies edits by hand; the old text stays in the store. | Tested; **Open** as a product question: is that acceptable? |
| 11 | A new post's slug appears on main | Conflict, with no overwrite. | Tested |
| 12 | 409 where only the branch moved | One retry with the same sha, after a re-read shows the file is unchanged. The re-read sha is never sent, which would overwrite someone's edit. | Tested |
| 13 | Preview branch already exists | Reset to main with `force` and written with the branch's sha. Only `content/` branches are touched. | Tested |
| 14 | Post over the API size limit | Saves are refused above 900 KB; an over-limit read is an error, not an empty post. | Tested |
| 15 | Protected `main` | The token cannot push, so the error surfaces and the post stays pending. Vercel's build could also fail after a good commit, and the admin would not know. | Handled, untested; **Open**: deploy failure is not reported back |

### Partial failure, step by step

| # | Step that fails | Result | Status |
|---|---|---|---|
| 16 | Preview write at submit | Stays draft. | Tested |
| 17 | Store write after the preview | Stays draft; the retry reuses the branch. | Tested |
| 18 | Claim write at approve | Nothing is published. | Tested |
| 19 | Commit refused or rate limited | Stays pending, unlocked, retry works. | Tested |
| 20 | Commit times out but actually landed | The stored `publishAttempt` matches main, so a retry records it with no second commit. Send-back and reject are refused, because the post is already live. | Tested |
| 21 | Commit succeeds, store write fails | Retried three times, then the user is told it is live and to press approve again. The retry finds the stored file on main, including on a later day when a rebuilt file would differ, and records it under the original approver. | Tested; removing the check fails the test |
| 22 | Crash after the claim | The 2-minute lease expires and approval works again. | Tested |
| 23 | Preview cleanup fails after publish or reject | Logged only; the result stands. A leftover branch stays until the next submit of that slug. | Tested |

A related gap: during case 20, a commit that lands **after** the 2-minute lease expires could race a retry. The retry's `publish` then fails on the sha check, and the next retry reconciles. Handled, untested.

### Auth and sessions

| # | Case | Behaviour | Status |
|---|---|---|---|
| 24 | **Pages that call `requireUser` without a catch** | **Astro returns 500, not a redirect, when a page throws a Response.** Seen in the smoke test: `GET /admin/` with no session returned 500. API routes are fine because of `guarded()`. | **Open**: `src/pages/admin/index.astro` expects `requireUser` to return the Response (`auth instanceof Response`), but the agreed contract throws it. The page or `requireUser` must change; neither the page nor `src/middleware.ts` is in this task's scope. Fails closed, but no sign-in redirect appears |
| 25 | Allowing by email, not `sub` | A Google account's email can change (G). Someone who later gets a listed address would be let in, within what Google allows. | **Open**: owner accepted email lists in the spec |
| 26 | Removing an email | Role is read from the lists on every request, so access ends on the next request. Changing env vars on Vercel needs a redeploy to take effect. | Tested; redeploy timing **Open**: not checked on Vercel |
| 27 | Revoking one session while keeping the email | Not possible with a stateless cookie. Sessions last at most 12 hours. Changing `ADMIN_SESSION_SECRET` ends all of them. Logout clears the browser's cookie only; a copied cookie stays valid until expiry. | Secret change and expiry tested; **Open** as a known limit |
| 28 | Expired, missing, forged or reused OAuth state | Refused before any code exchange, with a "try again" message. | Tested; smoke |
| 29 | Two sign-in tabs | The second overwrites the cookie, so the first gets "try again". | Handled, untested |
| 30 | Bad `iss`, `aud`, `exp`, `nonce`, `email_verified` | Refused. The text `"true"` is not accepted as verified. | Tested |
| 31 | Vercel preview URLs | Each host needs its redirect URI registered with Google, otherwise `redirect_uri_mismatch` (G). Previews will not sign in unless given a fixed registered host. | **Open** |
| 32 | Deployed with settings missing | Sign-in fails closed. The message names the keys, never the values. | Tested |
| 33 | Dev sign-in in production | The route returns 404 when `DEV` is false. A `devRole` in a cookie is ignored. | Cookie case tested; route smoke-tested in dev only. **Open**: confirm in a production build, which this task may not run |
| 34 | Cross-site POST | 403, including JSON content types that `checkOrigin` skips, and a missing Origin. | Tested; smoke |
| 35 | Open redirect through `back` or flash | Only `/admin/` paths pass; encoded and backslash forms are refused. | Tested; smoke |
| 36 | Crafted flash text | Anyone can make a link showing a message on an admin page. Astro escapes it, so it cannot inject markup, but it can mislead. | Handled; **Open** as low risk |

### Slugs and site routing

Posts live at the site root (`src/lib/content/registry.ts`). A published post on a redirect or gone path **fails the whole site build**, so these checks protect every page, not just the post.

| # | Case | Behaviour | Status |
|---|---|---|---|
| 37 | Slug is another page | Refused at create. | Tested; smoke against the real registry |
| 38 | Slug is a route (`admin`, `blog`, `demo` and others) | Refused. | Tested. The list is written by hand, so a new `src/pages` folder must be added: **Open** risk |
| 39 | Slug under an exact, prefix or children redirect or gone rule | Refused. | Tested |
| 40 | A draft sitting on a merge or drop rule is approved | Refused at submit and approve, because self-ownership never excuses a rule. | Tested |
| 41 | Rule added after submit | Refused at approve. | Tested |
| 42 | Slug on main but not yet in this deployment | Caught by reading main. | Tested |
| 43 | Rule on main but not yet in this deployment | Rules are read from what this deployment was built with, so a newer rule is not seen. The site build would fail, and the live site stays on its last good deployment. | **Open** |
| 44 | Route data cannot be read | Create and approve fail closed. | Tested |
| 45 | Traversal or bad characters | Refused before any path or URL is built. | Tested; smoke |

### GitHub rate limit

| # | Case | Behaviour | Status |
|---|---|---|---|
| 46 | Primary limit, `retry-after`, bare 429 | Stops at once with no retry, and tells the user how long to wait. | Tested |
| 47 | 403 that is not a limit | Reported as a permission error. | Tested |
| 48 | Secondary 403 with neither header | Indistinguishable from a permission error by headers alone, so it is reported as one. The guide says to wait a minute (H3). | **Open** |

### Stored data

| # | Case | Behaviour | Status |
|---|---|---|---|
| 49 | jsonb reorders keys | Documents are stored as text inside jsonb, and the hash sorts keys. | Tested |
| 50 | SQL injection | Parameters only. | Tested against a fake; **Open** on real Neon |
| 51 | First save of a real post reformats its YAML | Data is identical, but line folding changes, so the first diff is noisy. | Tested for data equality on all 154 posts; noise is accepted |
| 52 | Secrets in logs or history | Errors keep the status only, and unknown errors show fixed text. | Tested |
| 53 | An approver approving their own post | Allowed; the spec does not forbid it. | **Open**: owner decision |
