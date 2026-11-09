# Admin writing engine: edge cases and their sources

Research for `src/lib/admin/{engine,claude,fetcher,harness,prompts}.ts`, read on 6 November 2026. Nothing here was
tried against the live Claude API. Every claim about API behaviour comes from the documents or SDK types cited, and
every test uses a fake client. "Tested" below means a unit test with fakes.

## Sources

| Short name | URL |
| --- | --- |
| Web search | https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool |
| Server tools | https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools |
| Structured outputs | https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| Refusals | https://platform.claude.com/docs/en/build-with-claude/refusals-and-fallback |
| SDK types | `node_modules/@anthropic-ai/sdk/resources/beta/messages/messages.d.ts` (1.5.0) |
| Spam policies | https://developers.google.com/search/docs/essentials/spam-policies |
| Helpful content | https://developers.google.com/search/docs/fundamentals/creating-helpful-content |
| Google on generative AI | https://developers.google.com/search/docs/fundamentals/using-gen-ai-content |
| RFC 9309 | https://www.rfc-editor.org/rfc/rfc9309.txt |
| OWASP SSRF | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html |
| STORM | https://github.com/stanford-oval/storm (README, `knowledge_storm/rm.py`, `knowledge_storm/utils.py`) |
| GPT Researcher | https://github.com/assafelovic/gpt-researcher (README, `gpt_researcher/scraper/scraper.py`, `gpt_researcher/utils/url_security.py`) |

## What the sources changed in the design

- **Search URLs come from result blocks, not from prose.** Citations are always on for web search (Web search), and
  citations cannot be combined with structured output, per the brief. So `searchWeb` sends no output format, and code
  reads `web_search_tool_result` blocks. Judging happens in a separate `structured()` call with no tools.
- **`allowed_callers: ['direct']` is set on the search tool.** On `web_search_20260209` the default caller is code
  execution, with dynamic filtering (Server tools). Direct calls keep the results in plain blocks and avoid a code
  execution step on content from the web. The cost is more input tokens. This adds to the brief's tool definition.
- **Each search costs money beyond tokens:** $10 per 1,000, failed searches free (Web search). `Usage.webSearches` was
  added and the cost includes it.
- **Connect-time address checks.** OWASP says domain allowlisting and a check before connecting do not stop DNS
  rebinding: resolve, validate every address, connect only to a validated one, keep the hostname for TLS. GPT
  Researcher's `url_security.py` states it leaves this window open. Our default transport validates inside the socket's
  `lookup` hook, so the check and the connection use the same answer.
- **Human gate is structural.** Google asks that all AI content be manually fact-checked and reviewed, metadata
  included (Google on generative AI), and treats generating many pages without value as scaled content abuse (Spam
  policies). STORM's README says it "cannot produce publication-ready articles". The weekly limit, the outline stop,
  the null author and the draft-only output all follow from this.
- **YMYL.** Helpful content says health content "must be highly accurate and consistent with established expert
  consensus". Posts here address clinic operators, and the harness refuses dosing and directions to patients.
- **Adopted from STORM:** several differently angled searches before outlining; a pre-writing outline as a separate
  stage; a pluggable source filter (`is_valid_source` in `rm.py`), which is our blocked list.
- **Rejected from STORM:** trimming to the last complete sentence (`remove_uncompleted_sentences_with_citations`).
  Refusals says to treat partial output as incomplete and discard it, and a trimmed post would hide the failure.
- **Adopted from GPT Researcher:** rejecting pages with too little text (it uses under 100 characters in `scraper.py`;
  we use 500, as ours must support exact quotes); private-address blocking.
- **Rejected from GPT Researcher:** "most frequent information wins" as evidence. Its README presents this as an
  assumption, and web pages copy each other. Here a claim needs an exact quote that code finds on the page.

## Cases

Status: **tested**, **handled, untested**, or **open**. Test files are `tests/unit/admin-{engine,fetcher,harness}.test.ts`.

| Case | External fact | Handling | Status |
| --- | --- | --- | --- |
| Truncated output | `max_tokens` output "might be incomplete and not match your schema" (Structured outputs). `model_context_window_exceeded` is also a stop reason (SDK types) | Discarded, job `failed` with `failedStage`, retry available | tested |
| Refused output | 200 response, `stop_reason: refusal`, may not match schema; partial output must be discarded; `fallbacks: 'default'` retries server-side; a fallback attempt can be dropped under load and the refusal returned (Refusals) | Same, and the message names the category. `fallback` blocks are skipped when reading text | tested |
| Billing under fallback | Some refusals are billed; `usage.iterations` records each attempt; a fallback model has its own rates (Refusals) | Cost uses top-level usage at $4 and $20, so it is an estimate when a fallback ran | open: the shown cost can be off on those calls |
| `pause_turn` | Send the paused content back unchanged with the same tools; keep every paused response in order; cap continuations; searches count across requests in the turn (Server tools, Web search) | Appends, resends the same params, caps at 5, sums usage | tested |
| Search errors | HTTP 200 with an error object in place of the list; empty list means no results, not an error; codes `too_many_requests`, `invalid_tool_input`, `max_uses_exceeded`, `query_too_long`, `request_too_large`, `unavailable` (Web search) | Branches on list or object; partial failure keeps results and logs codes; total failure raises; empty fails as thin research | tested |
| Search disabled for the org | 400 `invalid_request_error`, not a result-block error (Web search) | Reaches the typed API error path, job fails with the message | handled, untested |
| Long blocked list | `request_too_large` is "typically" a long domain filter list; ASCII-only domains advised (Web search, Server tools) | 47 ASCII domains sent; if the code appears it surfaces as a search failure. Domains are also filtered in code | handled, untested at the real limit |
| Paywalled page | none | 401, 402, 403, 451 and wall phrases rejected, with the reason logged on the job | tested |
| JS-only page | GPT Researcher rejects short scrapes (`scraper.py`) | Under 500 characters of text is `thin-content`. No browser rendering, so these sources are lost | tested |
| Non-English source | none | Rejected by `lang` and by script and stopword ratio, because an approver could not check the quote. Multilingual pages with a non-`en` root `lang` are lost too | tested; the heuristic is unmeasured on real pages |
| PDF | none | Refused by extension, content type and `%PDF` bytes, with a message. Many regulators publish PDFs only, so this will lose good sources | tested as a refusal; reading PDFs is open and needs a parser dependency and an owner decision |
| Quote spanning markup | none | Inline tags vanish and block tags become line breaks; whitespace, quotes, dashes, soft hyphens and `[3]` marks normalised | tested |
| Number formats | none | `extractNumbers` compares value and unit: 1,000, 1000, 1 thousand; ₹1,00,000, 1 lakh rupees; crore; word multipliers; `$` never equals `₹`; dates either way round | tested |
| Bare multiples in a quote | none | "2.5 million" and "25 lakh" compare equal by value, which is right, but a rounded "about 2 million" against 1.9 million is flagged, and the writer must use the source's figure | tested for exact forms only |
| Invented number | none | Error in body, opening and FAQ; integers under 10 and years found in a source are warnings | tested |
| Statement number absent from its quote | none | Claim dropped even if the quote is real | tested |
| Prompt injection | none | `<source>` fences that a page cannot close, an untrusted-data instruction, no tools on those calls, hidden elements removed, injection-looking claims dropped, code checks links and numbers afterwards | tested with fakes; a real model's resistance is not verified, which is why the code checks exist |
| Out-of-date source | `page_age` is "when the site was last updated" (Web search) | Warning over 5 years, or undated and non-official. Not an error: the 2002 ethics regulations are old and in force | tested |
| Contradicting sources | none | Model reports conflicts with exact quotes; only those matching two verified claims survive; writer told to give both or neither; warning for the approver | tested for plumbing. Detection depends on the model, unverified. No deterministic detection: open |
| Double-running a stage | none | `Store.claimJob` compare-and-set, plus a lease and a final check that the lease is still ours | tested against a fake store with `claimJob`. **Open: `store.ts` does not implement `claimJob` yet.** The fallback write-then-read-back narrows the window but cannot close it across Vercel functions |
| Crash mid-stage | none | State is written only after a stage ends; lease expires after 320 s, then the stage re-runs. Tokens of the lost call are not counted | tested |
| Crash during `done` | none | Finds an existing submission by `jobId` before creating. jobId is set before content is saved | tested with a fake; adapter `createDraftSubmission` handled, untested |
| Weekly limit race | none | Count, write, recount; on overshoot the job marks itself rejected. Cannot exceed the limit, can under-admit | tested on the memory store |
| Medical advice | YMYL standard (Helpful content) | Writer and fact-checker prompts, plus a harness error for dosing and directions to patients. A regex will miss phrasing it does not know | tested for known phrasing |
| Slug already exists | none | `workflow.createSubmission` refuses pages, redirects, gone paths, posts on main and active submissions with 409; engine tries `-2` to `-6`, then fails. Never overwrites | tested with a fake 409 |
| SSRF | OWASP SSRF; encodings normalised by the URL parser | https only, IP literals, private names, metadata names, every resolved address, each redirect, connection-time lookup | tested, except connection-time lookup: handled, untested (needs a real socket) |
| robots.txt | RFC 9309: case-insensitive token, combined groups, longest match by octets, allow on tie, `*` and `$`, percent-encoding, at least 5 redirects, 4xx may access, 5xx complete disallow, 24 h cache, at least 500 KiB parsed | As specified. Stricter than the RFC in one place: 429 is treated as disallow | tested |
| Stage over 300 s | none | 270 s request timeout. `maxDuration` is not set in `astro.config.ts` or `vercel.json`, which is outside this work | open: confirm the function limit is 300 s |

## Conflicts found in the repo

- `docs/briefs/page-writing-rules.md` and `docs/content-guide.md` say "EasyClinic"; `src/lib/rules/text.ts` makes that an
  error and requires "Easy Clinic". The code wins, and prompts say "Easy Clinic".
- The brief allows `{token}` for numbers in the body, but `docs/content-guide.md` says tokens work only in frontmatter
  and a body `{` breaks MDX. The harness refuses braces in bodies and accepts the plain confirmed values there.
  `CONFIRMED_NUMBERS` in `harness.ts` is a hand copy of those values, so a price change must be made there too.
