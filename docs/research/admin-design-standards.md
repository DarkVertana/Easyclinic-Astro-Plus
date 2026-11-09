# Admin design standards: critique, spec and blueprint

Researched 6 Nov 2026. Research only; no project code was changed.

Inputs: 12 screenshots of the current admin, `src/components/admin/admin.css`, `AdminShell.astro`, tokens in `src/styles/global.css`, the `apple-hig` rules, and the public sources in section 7.

How to read the values:

- **[S1]** style tags point to a source in section 7.
- **[J]** marks my own judgement, fitted to this product. No source dictates that value.
- Contrast ratios were calculated from the token hex values with the WCAG formula.

---

## 1. Verdict

The admin is tidy, but it is a demo, not a tool. It shows data and rarely helps anyone act on it. It looks unfinished for five reasons:

1. **There is no working layer.** The list has no selection, sorting, row actions or pagination in view. The dashboard has nothing to do when counts are zero.
2. **Everything has the same weight.** Each element is a 12px-radius white card with the same 14px text. The eye has nowhere to land.
3. **Internal names reach the user.** Examples are `headKeyword`, `ctas`, `InlineCta`, `switching-to-emr` and `ANTHROPIC_API_KEY`.
4. **The editor looks like a developer's text box.** It has monospace Markdown, no title field, and a wall of red errors beside it.
5. **Density is too low for the job.** The 63px rows show about 10 of 154 posts on a 900px screen.

"Richer" should not mean more cards, colour or charts. It should mean more real information per screen, plus visible states, plus actions in the place where the need arises.

---

## 2. Blunt critique of the current screens

The black shape at the bottom of each screenshot looks like the dev toolbar, so I have not counted it as product UI.

### Shell

- The 240px navy-950 rail is the heaviest thing on every screen, yet it holds five links. It outweighs the content. **Replace it with a light rail.**
- The rail has no grouping, search or sign of what changed. The account block and sign-out are the only other content.
- The page header repeats the page's purpose in a subtitle ("What needs you today") and uses up 78–108px of height.
- Heading text is drawn bolder by the browser. Varela Round has only weight 400 (`astro.config.ts` says so), and `.adm h1` asks for 600. At 22px the synthetic bold looks smeared; see the "Easy Clinic" wordmark.

### Dashboard (`u-dash.png`)

- Three of the four KPI cards say 0. Each has a decorative icon and no link, trend or action.
- "98 Drafts to finish" is the only real signal. It has no breakdown or route to work through it.
- Two thirds of the screen is empty. The two "nothing here" panels are just more boxes.
- Nothing is shown about recent changes, upcoming publishing, or content health. The system has a refresh queue and an action history, yet neither appears here.

### Posts (`u-posts.png`)

- The second line under each title (`/features/emr/`) reads as the post's URL. It looks to be the owner page. On one row it is a bare `/`. This is misleading as well as noisy.
- The Author and Updated columns are nearly identical across rows, as is the green Published pill. Three columns use space and say little.
- No checkboxes, bulk actions, sort controls, row menu or visible pagination. No "view live" or "duplicate".
- Native selects look like a different product beside the custom tabs.
- Search, two selects and tabs take 105px before the first row.
- The "Waiting 0", "Sent back 0" and "Out of date 0" tabs are noise when zero, although they should stay put to avoid layout shift.

### New post dialog (`u-new.png`)

- It demands slug, topic and owner page before a word is written. The slug is not derived from the title, and the topic has a silent default of "Switching to EMR", so a careless click files the post wrongly.

### Editor (`u-editor.png`, `u-preview.png`)

- Title is not editable in place; it sits in the header as a page label. The "H1" is a separate field in a side rail, so the first thing a writer meets is a mismatch.
- The canvas is monospace, 14px, in a font outside the type tokens. It feels like editing a config file.
- The toolbar is five flat text words with no icons, grouping, state or shortcut.
- The Checks rail shows nine red items at once on a new draft. It treats unfinished work as failure. It repeats "Go to" links in raw field names, and "ctas" has no link at all.
- There is no save status: no "Saved 2 minutes ago", and no indication of unsaved changes.
- "Preview ready." floats alone at the bottom left. Status appears far from its cause.
- The primary action "Submit for approval" looks available even though nine errors block it, and only the rail explains why.

### Tablet editor (`u-tablet.png`)

- The restore banner uses `11/6/2026, 3:31:50 PM`. Elsewhere dates read `27 Sept 2026` or `2026-11-06`. That makes three date formats.
- The canvas appears blank while restorable text waits. A writer may fear the work is gone.
- Checks fall below a tall empty canvas, with no signal that they exist.

### Review (`u-review.png`)

- The top card reads "In search results / Part payments 13 of 60 / 0 of 155". These are meaningless numbers without labels.
- An **empty white card** sits under it. This looks like a rendering bug and should be investigated.
- Field values are raw: `draft`, `switching-to-emr`, `2026-11-06`.
- An approver cannot read the article itself in the visible view. The body should be the main thing here.
- This screen is reachable for a post not in review, which is what the info box apologises for.

### Approvals (`u-queue.png`), Generate (`u-gen.png`), Insights (`u-ins.png`)

- Approvals' empty state is a large, near-empty card.
- Generate is fully visible when it cannot work. The primary button is washed out at 60% opacity, and the page leads with an environment variable. An editor cannot act on that.
- Insights lists environment variable names to every user. That belongs in the admin guide or to admins only.
- The refresh queue repeats an Open button 98 times. It is also a list of truncated sentences, not a table with a sortable reason.

### Phone (`u-phone.png`)

- Nav scrolls sideways with "App…" cut off, and sign-out takes its own row.
- The first post starts about 530px down a 700px screen. Filters should collapse behind one control.

### Login (`u-login.png`)

- Fine. The dev sign-in is correctly described as local only. Leave it, beyond the heading weight fix.

### Token-level problems in the CSS

| Problem | Evidence | Fix |
|---|---|---|
| Input border fails non-text contrast | `--border` `#c7c7c7` on white is 1.69:1; WCAG 1.4.11 needs 3:1 for control boundaries | Inputs, selects and checkboxes use `--border-strong` (3.25:1) |
| Dark input border just misses | Dark `--border-strong` on dark surface is 2.93:1 | Raise before dark mode is ever switched on, or add a token decision |
| Disabled and busy by opacity | `.adm-btn:disabled { opacity: .6 }` | Muted fill and text; busy keeps full colour plus a spinner |
| `:focus` with `outline: none` | `.adm-input:focus` | `:focus-visible`, with a 2px `--focus` outline at 2px offset. `--focus` is 3.88:1 on white and 3.65:1 on grey-50 |
| Off-scale sizes | 22px h1, 15px h2, 13px labels | Map to type tokens (section 4.1) |
| Row selection colour missing | None defined | `--surface-alt` plus a checked box, never colour alone [S3] |

---

## 3. What the sources settle

| Topic | Decision | Basis |
|---|---|---|
| Row height | 48px for single-line rows, with two-line rows at 64px only if justified | Carbon sizes are 24/32/40/48/64, and 64 is meant for two-line rows [S1] |
| Row text | 14px regular; column header 14px semibold | Carbon [S1] |
| Cell padding | 16px left and right | Carbon [S1] |
| Bars match rows | Toolbar, bulk bar and pagination match the row size | Carbon [S2] |
| Bulk bar | Appears at the top of the table on selection, replacing search and filters. Row menus are disabled meanwhile. Cancel exits | Carbon [S2], Polaris [S4] |
| Row action | One visible at most; others in a menu | Primer [S6], Carbon [S2] |
| Menu visibility | Always visible, not hover-only | NN/G says hiding hurts discovery [S13]. Carbon keeps it persistent by default [S2]. This overrides Polaris's hover reveal [S4] |
| Pagination | Above 50 rows | Polaris React [S5]. The newer Polaris template says 100 [S4b]. I chose 50 |
| Filters | Chips: "+ Label" unset, value with clear when active. "Clear filters" appears only when active. Labels match columns | Stripe [S9] |
| Empty cell | "—" | Geist [S10] |
| Numbers | `tabular-nums` | Geist [S10], Vercel [S11] |
| URL state | Filters, tabs, sort and page live in the URL | Vercel [S11] |
| Empty table | Replaces the table; differs for "none exist" and "none match" | Stripe [S12], Geist [S10] |
| Confirm dialogs | Only for serious actions; offer undo instead where possible. Name the item and count. Buttons say the outcome. No default "Yes". Typed confirmation only for rare and dangerous actions | NN/G [S14] |
| Dialog buttons | Cancel left, action right; title and button name the same action; focus returns to the trigger | Carbon [S15], Atlassian [S16] |
| Toasts | **No timed toasts** | Primer advises against them [S7]; NN/G calls them poor for errors [S17]; `apple-hig` bans auto-dismissing UI. Polaris and Carbon do use them [S4, S18], so this is a deliberate pick |
| Saving | Explicit Save button stays; autosave protects text | NN/G [S19], Primer [S8] |
| Don't disable Save/Submit | Keep enabled, and show validation on click | Primer [S8], Vercel [S11] |
| Unsaved changes | Warn with `beforeunload`; keep input on failure | Primer [S8], Vercel [S11] |
| Loading | None under 1s; skeleton or spinner 1–10s; progress over 10s. Show delay 150–300ms, minimum visible 300–500ms | NN/G [S20], Vercel [S11] |
| Dashboard | One screen, for action. Length and position for numbers. No pies, gauges or treemaps | NN/G [S21] |
| Targets | WCAG minimum is 24px, and `apple-hig` requires 44px | [S22], skill |

Conflict between density and the 44px house rule: section 4.3 resolves it by separating visual size from hit area.

---

## 4. Design spec

All colours are existing tokens. No new brand colours, fonts or radii. Spacing is on a 4px step, in line with Atlassian's 8px base and half steps [S23].

### 4.1 Type

| Role | Font | Size | Weight | Line |
|---|---|---|---|---|
| Editor title | `--font-display` | `--text-2xl` (31px) | 400 | 1.2 |
| Page title | `--font-display` | `--text-lg` (20px) | 400 | 1.3 |
| Section title | `--font-sans` | `--text-base` (16px) | 600 | 1.4 |
| UI and table text | `--font-sans` | `--text-sm` (14px) | 400 or 500 | 1.45 |
| Column header, labels | `--font-sans` | `--text-sm` (14px) | 600 for headers, 500 for labels | 1.4 |
| Count badge, keyboard hint | `--font-sans` | `--text-xs` (12.8px) | 500 | 1.3 |
| Editor body | `--font-sans` | `--text-body` (17px) | 400 | 1.7 |
| Dashboard figure | `--font-sans`, tabular | `--text-xl` (25px) | 600 | 1.2 |

Rules:

- Set Varela Round at weight 400 in the admin. This stops the synthetic bold.
- Do not use `--text-xs` for sentences. `apple-hig` puts the floor for secondary text at about 14px.
- Sentence case throughout. No uppercase eyebrows.
- Single date format: `27 Sep 2026`, with time as `27 Sep 2026, 3:31 pm`. Within seven days use relative text with the full date in a `title` and `<time>`. This abbreviation style is [J]; the current `Sept` is acceptable if the project prefers it, but pick one.

### 4.2 Surfaces and colour

| Use | Token |
|---|---|
| Page background | `--surface-muted` |
| Panels, tables, rail | `--surface` |
| Structural hairlines | `--color-grey-200` light, `--border` dark (existing pattern) |
| Control boundary | `--border-strong` |
| Primary text / heading / secondary | `--ink` / `--ink-heading` / `--ink-muted` |
| Selected row and nav item | `--surface-alt` (blue-50) plus text weight or a checkmark |
| Primary button | `--btn-bg`, `--btn-ink` |
| Status | semantic `--success`, `--warning`, `--danger`, `--info` pairs. All pass at 5.75:1 or above |
| Radius: controls, menus, chips | `--radius-control` |
| Radius: panels and dialogs | `--radius-card` |
| Shadow | Only the existing `.adm-popover` shadow, on overlays only |

Never use `--color-grey-400` for text: it is 3.25:1. Teal stays out of the UI at 2.36:1, except the logo.

Reduce the number of boxes: a page gets one panel for its main object. Inside it, use hairlines and space. Never nest cards.

### 4.3 Sizes, targets and spacing

| Item | Visual | Hit area | Source |
|---|---|---|---|
| Default button, input, select | 36px | 44px, by a `::before` extending 4px up and down | [J], meets `apple-hig` |
| Large action (dialog, login) | 40px | 44px | existing |
| Icon button | 32px, 18px icon | 44px by pseudo-element; 12px gap between them | [J] |
| Checkbox | 16px box | whole cell, at least 44 × 48px | Vercel on shared targets [S11] |
| Chip | 32px | 44px | [J] |
| Table row | 48px | — | Carbon lg [S1] |
| Table header, bulk bar, toolbar | 48px | — | Carbon rule [S2] |
| Menu item | 36px | 44px on coarse pointers | [J] |
| `pointer: coarse` | All controls become 44px visual; rows 56px | existing pattern | |

Page padding is 24px, or 16px below 640px, as Primer does for narrow widths [S24]. Gaps: 8px within a group, 12px between controls, 16px within a panel, 24px between panels.

Motion: 120ms colour changes only (existing). No entrance animation for rows, panels or figures. Menus and dialogs may appear at once. Everything respects `prefers-reduced-motion`.

### 4.4 Shell

- **Rail:** 216px wide on `--surface`, with 1px hairline at right. [J; no source fixes this.] Carbon's and Primer's nav widths could not be verified.
- **Rail header:** 56px with logo and "Easy Clinic". Drop "Blog admin".
- **Search:** "Go to post…" button below the header with a `Ctrl K` hint. This opens the palette (section 4.14).
- **Nav item:** 36px, 12px padding, 18px icon, 8px radius. Default `--ink-muted` weight 500. Hover `--surface-muted`. Current: `--surface-alt`, `--ink-heading`, weight 600, `aria-current="page"`.
- **Order:** Dashboard, Posts, Calendar, Review (count), Generate, Insights. Trash is the last view in Posts, not a rail item. **Rename Approvals to Review** only if the team agrees; it is a preference, not a finding.
- **Count badge:** text in `--text-xs`, `--surface-muted` fill, with no colour alarm. Show only when above 0.
- **Foot:** avatar, name, role, and sign-out icon, in one 56px row.
- **Below 960px:** the rail becomes a 56px top bar with a menu button opening a sheet. No side-scrolling nav.
- **Page header:** one 56–64px row: title, then count or status text, then actions on the right. Maximum two text buttons. Sticky only on editor and review. Remove descriptive subtitles.

Keeping the navy rail is a one-line revert if the owner prefers it. See the decision list in section 8.

### 4.5 Data table

Structure: panel containing a tabs row (48px), toolbar (48px), table, footer (48px). Width is the full content width up to `--container-page`.

Posts columns, with width guidance as [J]:

| Column | Width | Content |
|---|---|---|
| Checkbox | 48px | shift-click for range, as Webflow does [S25] |
| Title | flexible, min 280px | 500 weight, one line with ellipsis and `title`; `<a>` is the only link |
| Status | 128px | pill |
| Topic | 168px | text |
| Author | 152px | text, "—" when none |
| Health | 96px | "OK" or "3 to fix" with icon |
| Updated | 120px | right aligned, tabular, sortable, default descending |
| Actions | 48px | "⋯" |

Header: 14px semibold, `--ink-muted`, on `--surface`, sticky when it scrolls [S13]. Sortable headers are `<button>` with an arrow and `aria-sort`. Atlassian warns against links or buttons in headings [S26], but sort controls are a standard exception; its docs describe built-in sorting.

Row states:

| State | Treatment |
|---|---|
| Default | `--surface` |
| Hover | `--surface-muted` |
| Selected | `--surface-alt` and checked box |
| Keyboard focus | 2px `--focus` inset outline on the row's focused element |
| Busy | Row text muted, spinner in Status |
| Error | Danger icon and text in the row, with a retry [S26] |

Only the title navigates. Do not make the whole row a target as well, as checkbox and menu misfires follow. `apple-hig` allows one link per row.

Below 960px, each row stacks as existing, but shows title, then a line with status and date, with the checkbox and menu retained. Polaris's `listSlot` primary/secondary is the model [S4].

Move the owner page out of the title cell. Add it as an optional column, labelled "Owner page". The slug is shown in the editor.

### 4.6 Filters, search and views

- **Views:** the existing status tabs are the views: All, Published, Drafts, In review, Sent back, Out of date, and Trash at the end. Seven is the `apple-hig` limit. Keep zero counts in muted text and avoid hiding them, so tabs do not jump. Counts stay with `tabular-nums`.
- **Search:** left of toolbar, 280–360px, placeholder "Search 154 posts…". Filters as people type with a debounce, and `aria-live` announces the count.
- **Filter chips:** "+ Topic", "+ Author" and "+ Health". Active chips read "Topic: Billing and claims ×". Then "Clear filters". [S9]
- **No-JS fallback:** the existing `<select>` form remains under the enhanced chips, which submit a GET form. Everything is URL state [S11].
- **Custom saved views:** not in the first version. Shareable URLs do most of the job. Linear and Notion show the fuller version (named views, shared or personal [S27, S28]), which needs per-user storage. Add only if asked.

### 4.7 Bulk action bar

Replaces the toolbar in place at the same 48px, so the table does not move [S2, S4].

Left to right:

1. Header checkbox: indeterminate when some rows are selected.
2. "12 selected" in `aria-live` text.
3. "Select all 154 posts" link, when the page is fully selected and more exist [S13, S29].
4. Two buttons at most, then "More actions" menu. `apple-hig` caps at two text buttons, while Carbon allows five [S2].
5. "Cancel" at the far right.

Labels are verb + noun [S5]: "Submit for review", "Change topic", "Change author", "Export CSV", "Move to trash".

Row menus are disabled meanwhile [S2]. Selection carries across pages [S25]. After the action, show a results banner: "Moved 12 posts to trash. Undo" [S29]. If some fail, list which and why, and leave them selected.

### 4.8 Row action menu

- Trigger: 32px icon button, always visible, `aria-label="Actions for {title}"` [S26].
- Menu: min width 200px, `--surface`, 1px hairline, `--radius-control`, popover shadow. Standard menu-button keyboard: arrows, Esc, focus return.
- Items by status: Edit, View live (published only), Preview, Duplicate, Copy link, then a divider, then "Move to trash" in `--danger`.
- Polaris rule of thumb: fewer than three actions should be inline [S2]. Here all rows have three or more.

### 4.9 Pills and health

- Pill: 24px tall, 8px side padding, 14px icon, `--text-xs` weight 500, keep `999px`. Always icon and text, so never colour alone.
- Mapping: Draft is neutral with dashed circle. In review is info with clock. Sent back is warning with return arrow. Published is success with check. Published with edits is info plus "Edited". Rejected is danger. Trashed is neutral with bin.
- "Published, edited" is the Sanity "Published, Draft" idea [S30]. Only show it if the data can tell them apart.
- Published is the normal state for most rows, so a **quieter text-with-dot** variant is tempting. Use the same icon + text with no fill for Published. A fill on every row is what made the current list look green. [J]

### 4.10 Messages

| Situation | Pattern | Rule |
|---|---|---|
| Field error | Inline, under the field | Move focus to first error on submit [S11] |
| Save success | Text in the editor's status slot | `role="status"`. No banner |
| Save failure | Banner in the editor, plus "Couldn't save" in the status slot | Keep input, offer Retry [S8] |
| Bulk or redirect result | Banner at top of content with Undo where possible | Stays until dismissed or next navigation [S8] |
| System problem | Banner, only for those who can act | Editors see "AI drafting is unavailable. Ask an admin to turn it on." Admins get the env detail or a guide link |
| Must decide now | Dialog | Rare [S14] |

No timed toasts. Banner: full content width, 12–16px padding, 18px icon, semantic pair, one action, optional close. All status text goes through a polite live region [S22 4.1.3]. Flash messages already use this route; reuse `Notice`.

### 4.11 Empty and loading states

Each empty state is compact, left aligned or centred within its own panel, and has no illustration. Use title + one sentence + one action, per Stripe's call-and-response [S12]:

| Case | Copy |
|---|---|
| Review, none waiting | "No posts waiting." "Posts appear here when an editor submits them." (no action needed for an empty queue) |
| Posts, filter empty | "No posts match these filters." + Clear filters. **Never** "Create your first post" here [S12] |
| Trash, empty | "Trash is empty." "Moved posts stay here until you restore them or delete them for good." |
| Dashboard panel, empty | One line of `--ink-muted` text, no box of its own, with a 1px dashed hairline only if layout needs structure [S12] |

Order of view states: loading, error, empty, content [S12].

Loading: pages are server rendered, so keep content first. For panels fetched afterwards, use a skeleton matching row height after a 200ms delay. For a single button, use a spinner with the label kept and "Saving…" [S11]. For AI jobs, use named step progress, as they exceed 10 seconds [S20]. Skeletons use `--color-grey-100` with no shimmer under reduced motion. No skeleton just for the shell.

### 4.12 Dialogs and destructive actions

| Action | Protection |
|---|---|
| Move to trash, one or many | No dialog. Immediate, with Undo in banner [S14, S11] |
| Discard restored text | Inline two-step in the banner |
| Publish to live site | Dialog listing what goes live: title, URL, and approver |
| Reject post | Dialog with required reason |
| Unpublish | Dialog naming the post and its URL |
| Delete for good, one | Dialog naming the post |
| Empty trash, or delete many for good | Dialog with a typed word [S14] |

Dialog: 448px wide (existing `min(28rem, 100vw - 2rem)`), native `<dialog>`, 24px padding. Title states the action: "Delete 'Part payments' for good?". Body gives the consequence in a sentence. Buttons are right aligned with Cancel left, action right [S15, S16]. Label: "Delete post", not "OK".

Destructive buttons use the existing outlined `.adm-btn-danger`, never the primary fill, as `apple-hig` requires. Carbon uses a filled danger button, but house rules win. Initial focus goes to the dialog title, so neither action is the default [S14]. Focus returns to the trigger, or the next row if the trigger has gone [S16, S26].

### 4.13 Save status

A single slot in the editor header, left of the actions, 14px, `--ink-muted`, `role="status"`:

| State | Text | Marker |
|---|---|---|
| Clean | "Saved 2 min ago" | none |
| Dirty | "Unsaved changes" | filled dot, plus text |
| Saving | "Saving…" | spinner after 200ms |
| Failed | "Couldn't save. Retry" | danger icon and link |
| Offline or local copy | "Saved in this browser only" | warning icon |

Keep the existing browser-side recovery and make the manual Save button stay. `Ctrl/Cmd S` saves. `beforeunload` warns when dirty. Save stays enabled, and its result is visible as text [S8, S19]. Server autosave is optional and depends on whether each save writes somewhere costly; I have not confirmed this. Do not add it without checking the save path.

Restore banner copy: "Unsaved text from 6 Nov, 3:31 pm is in this browser." with "Restore text" and "Discard". Add a short diff or word count, so the blank canvas doesn't suggest loss.

### 4.14 Command palette

Worth doing with 154 posts, in a later phase. Enhancement only, since every target stays reachable without it.

- `Ctrl/Cmd K` opens a 560px dialog, 96px from the top. It has a 48px input and 40px results, up to 8 visible.
- Groups: Posts (search by title) and Actions (New post, Go to Review, and so on). No fuzzy promises in the copy.
- ARIA: dialog with a `combobox` input controlling a `listbox`; `aria-activedescendant` moves with arrows; Enter accepts; Esc closes and restores focus [S31].
- Also show as a visible button in the rail. Shortcuts alone are hidden, and must not break non-QWERTY layouts [S11].

---

## 5. Screen blueprints

### 5.1 Dashboard

**Purpose:** see what needs doing and how the blog is doing, then go and do it.

Layout at 1200px and up: content column (about 2/3) plus side column (about 1/3), with 24px gap. One screen at 1440 × 900 [S21].

1. **Header:** "Dashboard", plus "New post" as primary and "Generate draft" as secondary.
2. **Pipeline strip, full width, 88px:** one horizontal stacked bar by length, not separate KPI cards [S21]: Drafts 98, In review 0, Sent back 0, Published 56. Each legend item is a link with a count to the filtered list. Use neutrals with one accent on the actionable segment, plus text labels. Zero segments stay in the legend.
3. **Needs you (main, top):** merged worklist, ordered by urgency, from review queue, sent back and failed publishes. Row: 48px, with title, reason, age and one action ("Review", "Fix"). Role-aware: approvers see review first, and editors see their sent-back posts first. Empty: "Nothing needs you." then show the next useful list below.
4. **Content health (main, below):** real checks as a ranked table: "Failing checks: 41 posts", "Refresh queue: 98", "Not updated in 365 days: 0". Top issue types such as "Missing meta description, 23 posts" link to the filtered list. Only show counts from existing data.
5. **This month (side):** compact calendar with marks on publish days, plus next scheduled items once scheduling exists. Before that, show "Published this month" using real dates. Avoid a chart if fewer than about 8 weeks of real data.
6. **Activity (side):** last 8 events from the existing `HistoryAction` log. "Asha approved Part payments, 2 h ago". Each line links to the post. "View all" only if a full page exists.
7. **AI jobs (side, only when open):** title, step, time, and link. Hide the panel at zero.

Analytics figures appear only once Insights is connected, with source and date range. Never placeholders.

### 5.2 Posts list

**Purpose:** find posts and act on one or many.

Layout: header row ("Posts", "154 posts", "New post"), then the single panel in 4.5–4.8.

- Default sort: Updated, descending.
- Footer: "1–50 of 154", previous and next, with `tabular-nums` [S5]. Page size is fixed at 50.
- About 15 rows fit in the first screen at 900px, up from 10.
- **New post flow:** dialog asks for title only. Slug derives from title and is edited later. Topic and owner become checks, and there is no silent topic default. This also addresses WCAG 3.3.7-style re-entry [S22].

### 5.3 Editor

**Purpose:** write the post, then get it ready to go through.

Model: title-first document like Ghost and Notion, with a settings panel like Ghost's post settings [S32]. Ghost's right-hand panel is secondary evidence for layout only.

```
┌ rail ┬ ← Posts  Draft · Saved 2 min ago        [Preview] [Save] [Submit for review] ┐ 56px sticky
│      ├──────────────────────────────────────────────┬────────────────────────────────┤
│      │ Title in display 31px                        │ [Ready] [Details] [SEO] [Links]│
│      │ Toolbar 40px, sticky under header            │  panel 336px, scrolls alone    │
│      │ Body 17/1.7, measure 720px, centred          │                                │
└──────┴──────────────────────────────────────────────┴────────────────────────────────┘
```

- **Title:** a borderless, auto-growing field in display 31px, with placeholder "Post title". It is the real H1 by default. Link label and other derived fields default from it and may be overridden in SEO. This removes the repeated entry and likely several of the nine errors at once. Whether H1 and title may share a value needs a content-rule check.
- **Body:** `--font-sans` at 17px on 1.7 inside `--container-measure` (720px). Replace the monospace canvas, as this is 90% of the feel. Keep Markdown as the storage format. A code-editor engine with live Markdown styling would be better, but that is an engineering call; a plain textarea in Poppins is the first step.
- **Toolbar, 40px, sticky:** groups split by hairline: Heading, then Bold and Link, then List, then "Insert call to action". Icon with tooltip giving the shortcut, `aria-pressed` where relevant, and text label for the CTA. `apple-hig`'s icon-grouping limit: three icon buttons per group.
- **Write/Preview:** header-level toggle, with split view at 1440px and wider. Preview must match the live template. Preview status appears inside the pane, not in the page foot.
- **Side panel, 336px** [J; Primer's minimum pane is 256px S33]. Tabs:
  - **Ready:** a progress line: "6 of 15 ready". Group checks as "Needed to submit", "Recommended" and "Passed" (collapsed). New drafts see neutral circles, and red appears only after a Submit attempt or on a field left blank after editing. Write the checks in plain language: "Add a call to action in the text". Each is a button that scrolls to and focuses the field.
  - **Details:** slug, topic, owner page, author, excerpt, feature image if the model has one.
  - **SEO:** head keyword, meta description with counter, and a search-result preview.
  - **Links:** body links with status, including the owner-page link.
- **Submit:** always enabled, as sources advise [S8, S11]. Pressing it with problems opens Ready, moves focus to the first problem, and states "Fix 3 things to submit". No separate "Check current text" button: run checks on Save and when idle.
- **Below 1200px:** panel becomes a slide-over from a "Ready 6/15" button in the header. Below 640px it is a full-screen sheet.
- **Overflow "⋯":** Duplicate, View history, Copy link, Move to trash.

Publishing is approval-gated, so the "publish panel" here is the review screen's decision panel (5.4). Do not copy Ghost's or Sanity's one-click publish [S30, S32].

### 5.4 Review

**Purpose:** read it, decide, and move on.

**Queue:** table with Title, Submitted by, Waiting (age, sorted oldest first), Health and Changes since last review. Rows open the detail. Same table spec. Single primary row action: "Review".

**Detail:** two-pane, reading first.

- **Left, flexible:** article rendered like the live site at 720px measure, with a toggle for "Changes" (diff against live, when republishing) and "Rendered". This takes over from the "every field" card. Sanity's history and compare are the model [S30, S34].
- **Right, 360px, sticky:**
  1. Decision block: submitter, age, health summary, and buttons "Approve and publish" (primary), "Request changes" (secondary), and "Reject" (ghost or danger text). Three buttons exceed the two-button rule, so stack them vertically at full width, or move Reject into "More". Comment box appears on Request changes, in place.
  2. Published fields: label-value list with human values (`Switching to EMR`, `6 Nov 2026`).
  3. Search-result preview.
  4. Links, with checks.
  5. History from `HistoryAction`.
- **After a decision:** go to the next post in the queue with a banner: "Published Part payments. View live". Keyboard: `J`/`K` for next and previous is optional, and needs a shortcut sheet.
- **Not in review:** this page should redirect to the editor or show a read-only state without decision controls or the empty card. Investigate the current blank card and the unlabelled "13 of 60" and "0 of 155" block. Either label these metrics or remove them.

### 5.5 Calendar and schedule

**Needs backend.** `src/lib/admin/types.ts` has states `draft | pending | changes_requested | published | rejected`, and I found no scheduled date field. A scheduled publisher is also required, such as a cron job. This is a product decision first. Without one, the page can only show past published dates and is low value by itself.

Blueprint, once there is a date field:

- Month grid by default, with a week toggle and a "Today" button, as in Notion [S35]. A 7-column grid, minimum row height 112px, with day number top left. Up to three post chips per day, then "+2 more". Today has a 2px `--focus`-style ring plus bold number.
- Chip: 24–28px, status icon + truncated title, full title in tooltip and accessible name.
- **Unscheduled tray, right, 280px:** approved or draft posts without a date. Notion's docs do not say how undated items display, so this is my addition [J].
- **Rescheduling:** drag is enhancement only. WCAG 2.5.7 requires a non-drag path [S22]: each chip has a "Reschedule" action with a date field. Use time zone text: "Times in IST", if that is the site's setting.
- **Below 960px:** agenda list, not a squeezed grid. Real `<table>` or list semantics with full dates in accessible names.
- **Empty:** "Nothing scheduled this month." with the tray as the next step.

### 5.6 Trash

**Needs backend.** No trash, archive or restore exists in `src/lib/admin`. Webflow's archive behaviour is a good reference: items leave the live site, remain in the CMS, and can be restored [S36].

- Route: the final tab of the Posts view, using the same table.
- Columns: Title, Was (status before trash), Deleted by, Deleted (date), Deletes on (only if there is a retention policy).
- Row actions: "Restore" visible, then "Delete for good" in the menu. Bulk: Restore, Delete for good.
- Header: "Empty trash" as an outlined danger button, with typed confirmation.
- A trashed published post needs an explicit rule. Does it go offline, and does the URL redirect? Bin a live post only through a dialog that says so. This matters for SEO and is not just a UI matter.
- Copy: don't claim auto-deletion unless it exists.

### 5.7 Media

**Not warranted now.** I found no upload code in `src/lib/admin` and no media route. Do not build an empty library for richness. If images become editable in the admin, start with an image field and uploader in the editor. Add a library grid when reuse is a real need: 160px tiles, filename, dimensions, "used in N posts", and required alt text.

### 5.8 Generate and Insights (not requested, but cheap to fix)

- **Generate:** when disabled, editors see a short notice and no dead form. Show the form for admins with the setup link. Job progress uses named steps with time so far.
- **Insights:** remove env names from the UI, except for admins. Turn the refresh queue into a table: Title, Reason, Topic, Updated, with a filter by reason. The title is the link, and the 98 Open buttons go away. Reason wraps to two lines, with the rest revealed on expand.

---

## 6. Things to avoid

- KPI cards with big numbers, stock icons and nothing to do.
- Cards inside cards, or a box around each empty state.
- Red for "unfinished". Save red for real blockers after an attempt.
- Timed toasts, or any status far from its cause.
- Hover-only row actions on anything essential.
- Native selects next to custom controls in the same toolbar, once chips are built.
- Disabled primary buttons with no explanation.
- Raw field names, slugs, ISO dates or environment variables.
- Sparklines, donuts, gauges or placeholder analytics without real data [S21].
- Purple or gradient accents, glass, glows, shimmer, uppercase eyebrows, and new shadows.
- Filled danger buttons, and typed confirmation for routine actions.
- A rich-text rebuild just to look modern. Fix type, title and panel first.
- Calendar, trash or media screens without the backend to make them true.
- Drag as the only way to do anything.
- Keyboard shortcuts as the only route to anything.

---

## 7. Sources

Fetched and read unless marked otherwise.

| Tag | Source |
|---|---|
| S1 | Carbon data table style: https://carbondesignsystem.com/components/data-table/style/ |
| S2 | Carbon data table usage: https://carbondesignsystem.com/components/data-table/usage/ |
| S3 | `apple-hig` skill rule, reinforced by Atlassian in S26 |
| S4 | Polaris index table composition: https://shopify.dev/docs/api/app-home/patterns/compositions/index-table |
| S4b | Polaris resource index template: https://shopify.dev/docs/api/app-home/latest/patterns/templates/resource-index |
| S5 | Polaris React index table, **search excerpt only**: https://polaris-react.shopify.com/components/tables/index-table |
| S6 | Primer data table: https://primer.style/product/components/data-table/ |
| S7 | Primer accessible notifications: https://primer.style/accessibility/patterns/accessible-notifications-and-messages/ |
| S8 | Primer saving: https://primer.style/product/ui-patterns/saving/ |
| S9 | Stripe filter controls: https://docs.stripe.com/stripe-apps/patterns/filter-controls |
| S10 | Vercel Geist table: https://vercel.com/geist/table |
| S11 | Vercel Web Interface Guidelines: https://vercel.com/design/guidelines |
| S12 | Stripe empty state: https://docs.stripe.com/stripe-apps/patterns/empty-state |
| S13 | NN/G data tables: https://www.nngroup.com/articles/data-tables/ |
| S14 | NN/G confirmation dialogs: https://www.nngroup.com/articles/confirmation-dialog/ |
| S15 | Carbon dialog pattern: https://carbondesignsystem.com/patterns/dialog-pattern/ |
| S16 | Atlassian modal dialog: https://atlassian.design/components/modal-dialog/usage |
| S17 | NN/G indicators, validations, notifications: https://www.nngroup.com/articles/indicators-validations-notifications/ |
| S18 | Carbon notification: https://carbondesignsystem.com/components/notification/usage/ |
| S19 | NN/G floppy disk icon, **search excerpt only**: https://www.nngroup.com/articles/floppy-disk-icon-understandability/ |
| S20 | NN/G skeleton screens: https://www.nngroup.com/articles/skeleton-screens/ |
| S21 | NN/G dashboards: https://www.nngroup.com/articles/dashboards-preattentive/ |
| S22 | WCAG 2.2 (1.4.10, 1.4.11, 2.4.11, 2.5.7, 2.5.8, 3.3.7, 4.1.3): https://www.w3.org/TR/WCAG22/ |
| S23 | Atlassian spacing: https://atlassian.design/foundations/spacing |
| S24 | Primer layout: https://primer.style/product/getting-started/foundations/layout/ |
| S25 | Webflow collection items, **search excerpt only**: https://help.webflow.com/hc/en-us/articles/33961289539347-Collection-items-overview |
| S26 | Atlassian dynamic table: https://atlassian.design/components/dynamic-table/usage |
| S27 | Linear custom views, **search excerpt only**: https://linear.app/docs/custom-views |
| S28 | Notion views, **search excerpt only**: https://notion.com/help/views-filters-and-sorts |
| S29 | NN/G bulk actions, video summary only: https://www.nngroup.com/videos/bulk-actions-design-guidelines/ |
| S30 | Sanity history: https://www.sanity.io/docs/user-guides/history-experience |
| S31 | WAI-ARIA APG combobox: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/ |
| S32 | Ghost publishing options: https://ghost.org/help/publishing-options/ |
| S33 | Primer page layout: https://primer.style/product/components/page-layout/ |
| S34 | Sanity compare versions, **search excerpt only**: https://www.sanity.io/docs/studio/compare-document-versions |
| S35 | Notion calendars: https://www.notion.com/help/calendars |
| S36 | Webflow save and publish items, **search excerpt only**: https://help.webflow.com/hc/en-us/articles/33961230697107-Save-and-publish-Collection-items |

Also read: Linear's redesign write-up (https://linear.app/now/how-we-redesigned-the-linear-ui), used for direction only, with no numeric values; Atlassian flag (https://atlassian.design/components/flag/usage), and Shopify's details template (https://shopify.dev/docs/api/app-home/patterns/templates/details), for primary/secondary column structure and the Save Bar.

### What I could not verify

- **Polaris classic docs:** `polaris-react.shopify.com` pages redirected when fetched. The "50 items", verb + noun and 490px rules come from search excerpts of those pages. No resource-index widths were found.
- **Sidebar widths:** Carbon's left-panel page has no values in the fetched text. Primer's preset pane widths were not stated, only a 256px minimum. **The 216px rail and 336/360px panels are judgement.**
- **Row height outside Carbon:** Primer, Atlassian, Geist and Polaris gave no row height in the fetched text.
- **Stripe Dashboard and Linear internals:** Stripe's public docs cover Stripe Apps patterns, which reflect the Dashboard but are not a spec for it. Stripe says its section-level empty state mirrors the Dashboard. Linear gives no pixel values. Its Cmd K behaviour was not documented in what I found. I did not log in to any product.
- **Ghost:** the official scheduling page URL I tried returned 404. Editor panel details came from `publishing-options`; the "new publish flow" modal appears only in source-mirror commit messages, so I did not rely on it.
- **Sanity:** status dots and "ready for review" appeared only on third-party sites and were not used. The Review Changes pane appears in changelog excerpts only.
- **Webflow:** bulk flow details come from help-centre search excerpts, not fetched pages.
- **Notion:** undated items in calendar view are not addressed.
- **NN/G:** `/articles/bulk-actions/` returned 404, so only a video summary was available. Autosave guidance comes from excerpts.
- **Project unknowns:** I read `types.ts` and grepped `src/lib/admin`, not all admin code. I inferred from screenshots that the grey line under titles is the owner page and that the black shape is a dev toolbar. Pagination might exist below the screenshot's fold. Whether publishing writes to Git, the cost of autosave, and the cause of the blank card on review are all unconfirmed. Counts in blueprints such as "41 posts" or "23 posts" are **illustrative examples, not real data**.

---

## 8. Decisions for the owner

1. **Replace the navy rail with a light rail?** I recommend yes, as it gives content the visual lead. The loss is some brand presence.
2. **Build scheduling and trash?** Each needs backend and rules first. Trash on live posts also needs a decision on redirects.
3. **Plain textarea in Poppins, or a code-editor engine with live Markdown styling?** Start with the first; assess after use.
4. **Filled or outlined danger button?** The spec follows the outlined house rule, against Carbon's filled pattern.

### Suggested order

1. Tokens, type, shell, messages and copy cleanup.
2. Posts table with selection, bulk actions, menu and pagination.
3. Editor: title, body, panel and save status.
4. Review reading pane and decision panel.
5. Dashboard.
6. Palette, then calendar and trash after their backend work.
