# Blog admin UI: edge cases

Research behind the `/admin/` pages, read on 2026-11-06. "HIG" means the local copy at
`~/.claude/skills/apple-hig/references/APPLE-HIG.md`, cited by section. Each section also has a public URL under
`https://developer.apple.com/design/human-interface-guidelines/`.

## Sources

| Short name | Fact used | Source |
| --- | --- | --- |
| HIG Saving work | "Help people be confident that their work is always preserved unless they cancel or delete it." | HIG, File management, Saving work (`/file-management`) |
| HIG Feedback | A warning about possible data loss should interrupt; status belongs near what it describes; say why a command cannot be carried out | HIG, Feedback (`/feedback`) |
| HIG Alerts | Be direct and neutral; no "Error" titles; verb button titles; a destructive action needs a Cancel button that is not the default | HIG, Alerts (`/alerts`) |
| HIG Lists | Keep row text succinct; preserve the readability of text that would clip; descriptive column headings | HIG, Lists and tables (`/lists-and-tables`) |
| HIG Text fields | Keep a label as well as any placeholder; validate at a sensible time; tab order flows as expected | HIG, Text fields (`/text-fields`) |
| HIG Loading | Show something as soon as possible; say what is loading | HIG, Loading (`/loading`) |
| HIG Generative AI | Keep people in charge; disclose AI use; raise awareness of hallucinations; specific feedback during generation; retry near results; work when AI is unavailable | HIG, Generative AI (`/generative-ai`) |
| WCAG 2.2 | 1.4.4, 1.4.10, 1.4.11, 2.1.1, 2.4.3, 2.4.7, 2.4.11, 2.5.8, 3.2.2, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.7, 4.1.2, 4.1.3 | https://www.w3.org/TR/WCAG22/ |
| MDN beforeunload | Not reliably fired, especially on mobile; needs sticky activation; attach it only while data is unsaved; `visibilitychange` is the better save signal | https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event |
| MDN 303 | A 303 after POST makes the browser GET the `Location` URL; the POST is not repeated | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/303 |
| MDN 409 | The request conflicts with the current state of the resource, so the user can resolve it and resubmit | https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/409 |
| Astro CSP docs | Hashes for processed scripts and styles; external ones are unsupported without your own hash; **not supported in `dev`, test with `build` and `preview`** | https://docs.astro.build/en/reference/configuration-reference/ (`security.csp`) |
| Astro checkOrigin | On-demand pages only; POST, PATCH, DELETE and PUT with no content type or a form content type; cross-origin gets 403; uses `Sec-Fetch-Site`, then `Origin` | same page (`security.checkOrigin`) |
| Astro source | `cspDestination: manifest.csp?.cspDestination ?? (routeData.prerender ? "meta" : "header")` | `node_modules/astro/dist/core/fetch/fetch-state.js:337` (astro 7.3.5) |

## What the CSP means for these pages

- The docs describe only a `<meta>` element. The installed source shows that on-demand pages get the policy as a
  **response header** instead, and `tests/e2e/csp.spec.ts` assumes the same. `src/middleware.ts` copies response
  headers for `/admin/`, so the header should survive; the browser pass needs to confirm this.
- The policy is not enforced in `astro dev`, so a clean dev session proves nothing. CSP has to be checked with
  `build` and `preview`.
- The allowed style attributes are only the three `text-align` hashes. Admin markup uses classes and the `hidden`
  attribute, never `style=`. `marked` writes `align="..."` on table cells, so a preview table needs no style attribute.
- `checkOrigin` does not cover a JSON `content-type`. Admin scripts send `FormData`, so the check applies to them.
  Any endpoint that accepts JSON needs its own origin check, which is the backend's job.

## Cases

| Case | Decision | Basis |
| --- | --- | --- |
| Session expires mid-edit | The script keeps a browser draft while typing and on `visibilitychange`. The draft stays until a loaded page shows the same values. After signing in again, a notice offers Restore or Discard. Without JS the text can be lost, so the backend's redirect should say why. | HIG Saving work; WCAG 3.3.7; MDN beforeunload |
| Stale save (conflict) | `expectedUpdatedAt` goes with each save. On a rejected save the page reloads with the flash and the draft notice, which says the post has changed since the draft began. The person chooses; nothing is merged automatically. | MDN 409; HIG Alerts |
| Double submit | The script disables the button and shows progress on first submit, and re-enables it on `pageshow`. The real guard is on the server: `expectedUpdatedAt`, state checks and `viewedHash`. | HIG Buttons; WCAG 4.1.2 |
| Very long titles and bodies | Titles wrap with `break-words` and `min-w-0`, never clip. The title counter is advice and does not block typing. The preview script handles a failed request, such as an oversized body, by leaving the text alone. | HIG Lists; WCAG 1.4.10 |
| 154+ rows | One server-filtered list with no pagination; 154 text rows are small. Typing fetches the filtered page (debounced) and swaps only the results, so focus stays in the search box. The count is announced through `aria-live`. | HIG Searching; WCAG 4.1.3 |
| Empty FAQ | Valid: the content guide allows three to eight questions or none. Zero rows serialize to `[]`, with a line saying so. Rows with both fields blank are dropped. | docs/content-guide.md |
| Missing author | `author: null` is valid in a draft. The row hint says "No author", the select offers "No author yet", and the checks panel explains the block. | WCAG 3.3.1, 3.3.3; schema `pageBase` |
| Store outage | Each page catches the error and shows a plain notice in the shell. Git-based lists still render where possible, marked as incomplete. No stack trace is shown and error details stay out of the page. | HIG Alerts; HIG Feedback |
| Config not set | The notice names the variable to set. Generate still renders without `ANTHROPIC_API_KEY`, with the form explained and the action disabled. | HIG Generative AI |
| 320px and 200% zoom | Rows stack below `lg`, the nav wraps, and sizes are rem-based with no fixed heights on text. 1280px at 200% acts like 640px, so it gets the stacked layout. Only code and tables in the preview scroll, inside their own box. | WCAG 1.4.4, 1.4.10 |
| Dark theme | Tokens only. `.btn-outline` uses fixed blue-700 on the dark surface, and that fails contrast, so admin secondary buttons add `dark:` token overrides. `global.css` is unchanged. | WCAG 1.4.3, 1.4.11; `global.css` |
| Keyboard only | Native links, buttons, `details` and forms; a skip link; check links focus their field and open its disclosure. The textarea does not trap Tab. Sticky elements must not cover focus. | WCAG 2.1.1, 2.4.3, 2.4.7, 2.4.11 |
| JS off | Every action is a real form. FAQ falls back to a visible JSON textarea. Preview falls back to a server render of the saved version. Search uses a submit button. Suggest topics is JSON-only, so it stays hidden without JS and the page says so. | Project constraint; HIG Loading |
| Back button after POST | The backend should answer with 303 so back never repeats a POST. Pages are `no-store`, so back refetches current state; the draft notice recovers typed text and `pageshow` re-enables buttons. | MDN 303 |
| Approver opens a post that has since changed | `viewedHash` carries the hash the approver read. If it no longer matches, the server refuses and the page reloads with the new content and hash. The approver's answers survive in a browser draft, but they must read again. | WCAG 3.3.4 (adopted as a principle; publishing is not strictly its legal or financial scope); HIG Generative AI |

## Other decisions from the research

- `beforeunload` is only a backstop, because it is unreliable. The draft is what protects text.
- Change events never navigate. Filters update results in place and keep focus (WCAG 3.2.2).
- Errors are text next to the field, and each check links to its field (WCAG 3.3.1).
- Reject is a two-step inline disclosure with a Cancel control. It never has the primary style.
- AI pages say what each step is doing, label AI findings as unproven, and show rejected claims (HIG Generative AI).
- Controls are 44px, above the 24px minimum in WCAG 2.5.8, because the project rule is stricter.
