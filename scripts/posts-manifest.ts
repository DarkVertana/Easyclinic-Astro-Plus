/**
 * Builds migration/posts-manifest.csv: every live blog post with its research class, a PROPOSED
 * decision and target (spec 3.6: prune ~403 posts to ~120, each owned by a landing page). Marketing
 * confirms the decisions before any redirect or 410 is generated from this file.
 *
 * Rows the research left UNSURE ("review") take their decision, target, owner and reason from
 * migration/posts-review-proposals.csv (a content review, 2026-09-26) when that file has a row for them.
 * There was no Search Console data for that review, so those reasons say so and never claim rankings.
 *
 * Posts held in the 2026-09-26 refresh (migration/posts-triage.csv, from node scripts/posts-triage.ts) turn their
 * "keep" row into a merge into the resolved final target, with no owner page. A review proposal that merges into a
 * held post is re-pointed to that post's final target (the proposals CSV itself is left as the review wrote it).
 * Either change is a new proposal: a confirmation carries over only if the previous manifest already had the same
 * decision and target for that path.
 *
 * Usage: node scripts/posts-triage.ts && node scripts/posts-manifest.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { normalizePath } from '../integrations/routes-core.ts';
import { parseCsv, parseCsvRecords, stringifyCsv } from './lib/csv.ts';
import { TRIAGE_COLUMNS, TRIAGE_CSV, TRIAGE_DATE } from './posts-triage.ts';

const md = readFileSync('migration/research/sitemap.md', 'utf8');
const section = (title: string) => {
  const start = md.indexOf(`### ${title}`);
  const block = md.slice(start, md.indexOf('```', md.indexOf('```', start) + 3));
  return [...block.matchAll(/^(\/[a-z0-9-]+\/)$/gm)].map((m) => m[1]);
};
const classes: Array<[string, string]> = [
  ['KEEP-buyer', 'keep'],
  ['MERGE-ai-explainer', 'merge'],
  ['DROP-frontier', 'drop'],
  ['UNSURE', 'unsure'],
];

/**
 * Slug matching works on whole words (the slug split on "-" and "/"), each pattern a list of word prefixes.
 * Substring regexes misfired: "ent-" matched "management-", "skin" matched "asking", "sha" matched "share".
 */
const words = (path: string) => path.split(/[/-]+/).filter(Boolean);
/** A pattern with a hyphen is a phrase of whole words ("no-show", "multi-location"); otherwise a word prefix. */
const matches = (path: string, patterns: string[]) =>
  patterns.some((p) => (p.includes('-') ? `-${words(path).join('-')}-`.includes(`-${p}-`) : words(path).some((w) => w.startsWith(p))));

/** Owning landing page by topic (spec 3.6: each kept post is owned by a landing page). First match wins. */
const OWNERS: Array<[string[], string]> = [
  [['whatsapp'], '/features/whatsapp/'],
  [['no-show', 'no-shows', 'noshow', 'appointment', 'scheduling', 'booking'], '/features/appointment-scheduling/'],
  [['billing', 'invoice', 'cash', 'fraud', 'gst'], '/features/billing/'],
  [['claim', 'payor', 'insurance', 'tpa', 'nhif'], '/features/insurance-claims/'],
  [['revenue', 'leak', 'break', 'financial', 'rcm'], '/features/revenue-management/'],
  [['pharmac', 'inventory', 'stock', 'expiry'], '/features/pharmacy-and-inventory/'],
  [['lab', 'patholog'], '/features/lab/'],
  [['telemedicine', 'teleconsult', 'telehealth', 'virtual'], '/features/telehealth/'],
  [['engagement', 'retention', 'recall', 'feedback', 'referral', 'portal'], '/features/patient-engagement/'],
  [['dashboard', 'report', 'kpi', 'analytics'], '/features/reports-and-dashboards/'],
  [['chain', 'branch', 'multi-location', 'multiple-clinic', 'multi-site', 'multi-clinic', 'multiple-locations'], '/solutions/clinic-chain/'],
  [['compliance', 'abdm', 'ndhm', 'privacy', 'legal', 'hipaa', 'dpdp', 'pdpa'], '/trust/'],
  [['emr', 'paperless', 'records', 'prescription'], '/features/emr/'],
  [['kenya', 'nairobi', 'kmpdc', 'sha'], '/emr-software-in-kenya/'],
  [['nigeria', 'lagos'], '/hospital-management-software-nigeria/'],
  [['dubai', 'uae'], '/clinic-management-software-uae/'],
  [['india', 'mumbai', 'delhi', 'tier'], '/clinic-management-software-india/'],
  [['setup', 'start', 'profitable', 'opening', 'launch'], '/start-a-clinic/'],
  [['ai', 'artificial'], '/ai/'],
];
/** Specialty-software posts compete with the specialty pages (research note): merge into them. */
const SPECIALTY: Array<[string[], string]> = [
  [['dental', 'dentist', 'orthodont'], '/dental-emr-software/'],
  [['dermat', 'skin', 'cosmet', 'aesthetic', 'trich'], '/dermatology-emr-software/'],
  [['paediat', 'pediat', 'child'], '/pediatric-emr/'],
  [['cardio'], '/cardiology-emr/'],
  [['psychiat', 'mental', 'psycholog'], '/mental-health/'],
  [['ophthal', 'eye'], '/ophthalmology-emr/'],
  [['orthop'], '/orthopedic-emr/'],
  [['gynae', 'gyne', 'obgyn', 'obstet'], '/obgyn-emr-software/'],
  [['ivf', 'fertility'], '/ivf-emr/'],
  [['physio'], '/physiotherapy-clinic-management-software/'],
  [['ayurved'], '/ayurveda-clinic-management-software/'],
  [['ent', 'otolaryng'], '/ent-emr-software/'],
  [['neuro'], '/neurology-emr/'],
];
/** Legacy URLs that are already pages in src/content (guides, comparisons, specialty pages kept at their slugs). */
const PAGE_SLUGS = new Set(
  ['guides', 'comparisons', 'specialties', 'listicles']
    .filter((dir) => existsSync(`src/content/${dir}`))
    .flatMap((dir) => readdirSync(`src/content/${dir}`).map((f) => `/${f.replace(/\.(ya?ml|mdx)$/, '')}/`)),
);
const comparisonPages = new Set(['/easyclinic-vs-practo/', '/easyclinic-vs-healthplix/', '/easyclinic-vs-kenyaemr/', '/easyclinic-emr-vs-traditional-emr/']);
/** Marketing's confirmations survive a regeneration: carried over by path. */
const previous = existsSync('migration/posts-manifest.csv') ? parseCsv(readFileSync('migration/posts-manifest.csv', 'utf8')) : [];
const confirmedCol = previous[0]?.indexOf('confirmed') ?? -1;
const confirmedByPath = new Map(confirmedCol >= 0 ? previous.slice(1).map((r) => [r[0], r[confirmedCol] ?? '']) : []);
const [decisionCol, targetCol] = ['proposed_decision', 'target'].map((c) => previous[0]?.indexOf(c) ?? -1);
const previousProposal = new Map(previous.slice(1).map((r) => [r[0], `${r[decisionCol] ?? ''} ${r[targetCol] ?? ''}`]));
const droppedConfirmations: string[] = [];
/** A row this script changed keeps its confirmation only when marketing confirmed this same decision and target. */
const confirmedFor = (path: string, decision: string, target: string, changed: boolean) => {
  const confirmed = confirmedByPath.get(path) ?? '';
  if (!changed || !confirmed.trim() || previousProposal.get(path) === `${decision} ${target}`) return confirmed;
  droppedConfirmations.push(`${path} ("${confirmed}" was for ${previousProposal.get(path)})`);
  return '';
};

/** Held posts (columns: path, target, final_target, reason), resolved by scripts/posts-triage.ts. */
const HELD_NOTE = `Held in the ${TRIAGE_DATE} refresh:`;
const triageCsv = existsSync(TRIAGE_CSV) ? parseCsvRecords(readFileSync(TRIAGE_CSV, 'utf8')) : null;
if (!triageCsv) console.warn(`  ! ${TRIAGE_CSV} not found: no held posts applied (run node scripts/posts-triage.ts)`);
const triageMissing = triageCsv?.records.length ? TRIAGE_COLUMNS.filter((c) => !triageCsv.header.includes(c)) : [];
if (triageMissing.length) throw new Error(`${TRIAGE_CSV} has no ${triageMissing.map((c) => `"${c}"`).join(', ')} column`);
const held = new Map(
  (triageCsv?.records ?? []).map((r): [string, { final_target: string; reason: string }] => [
    normalizePath(r.path),
    { final_target: normalizePath(r.final_target.trim()), reason: r.reason },
  ]),
);
const triageErrors = (triageCsv?.records ?? []).flatMap((r) => {
  const final = r.final_target.trim();
  if (!final.startsWith('/') || normalizePath(final) === normalizePath(r.path)) return [`${r.path}: final_target "${r.final_target}" is not another path`];
  if (held.has(normalizePath(final))) return [`${r.path}: final_target ${final} is itself held; re-run node scripts/posts-triage.ts`];
  if (!r.reason.trim()) return [`${r.path}: no reason`];
  return [];
});
if (held.size !== (triageCsv?.records.length ?? 0)) triageErrors.push(`${TRIAGE_CSV} lists a path twice`);
if (triageErrors.length) {
  for (const e of triageErrors) console.error(`  ✗ ${e}`);
  console.error(`\n${TRIAGE_CSV} has ${triageErrors.length} unusable rows; nothing written.`);
  process.exit(1);
}
const usedHolds = new Set<string>();
const repointed: string[] = [];

/** Content-review proposals for "review" rows (columns: path, decision, target, owner, reason, evidence). */
const PROPOSALS_CSV = 'migration/posts-review-proposals.csv';
const PROPOSAL_NOTE = 'Proposed from content review 2026-09-26; no Search Console data:';
const proposalCsv = existsSync(PROPOSALS_CSV) ? parseCsvRecords(readFileSync(PROPOSALS_CSV, 'utf8')) : { header: [], records: [] };
const missingColumns = proposalCsv.records.length ? ['path', 'decision', 'target', 'owner', 'reason'].filter((c) => !proposalCsv.header.includes(c)) : [];
if (missingColumns.length) throw new Error(`${PROPOSALS_CSV} has no ${missingColumns.map((c) => `"${c}"`).join(', ')} column`);
const proposalRecords = proposalCsv.records;
const proposals = new Map(proposalRecords.map((r) => [r.path.trim(), r]));
const proposalErrors = proposalRecords.flatMap((r) => {
  const decision = r.decision.trim();
  const target = r.target.trim();
  if (!['keep', 'merge', 'drop'].includes(decision)) return [`${r.path}: decision "${r.decision}" (expected keep, merge or drop)`];
  if (decision === 'keep' && !r.owner.trim()) return [`${r.path}: a keep needs an owner page`];
  if (decision === 'merge' && (!target.startsWith('/') || target === r.path.trim())) return [`${r.path}: merge target "${r.target}" is not another path`];
  if (decision === 'drop' && target !== '410') return [`${r.path}: drop target "${r.target}" (expected 410)`];
  return [];
});
if (proposals.size !== proposalRecords.length) proposalErrors.push(`${PROPOSALS_CSV} lists a path twice`);
if (proposalErrors.length) {
  for (const e of proposalErrors) console.error(`  ✗ ${e}`);
  console.error(`\n${PROPOSALS_CSV} has ${proposalErrors.length} unusable rows; nothing written.`);
  process.exit(1);
}
const usedProposals = new Set<string>();

const rows = [['path', 'research_class', 'proposed_decision', 'target', 'owner_page', 'reason', 'confirmed']];
for (const [title, cls] of classes) {
  for (const path of section(title)) {
    const specialty = SPECIALTY.find(([prefixes]) => matches(path, prefixes) && matches(path, ['software', 'management', 'emr', 'system', 'automation']));
    const owner = OWNERS.find(([prefixes]) => matches(path, prefixes))?.[1] ?? '/blog/';
    let decision = cls;
    let target = path;
    let reason = '';
    let ownerPage: string | undefined;
    const proposal = proposals.get(path);
    if (comparisonPages.has(path)) {
      decision = 'keep';
      reason = 'Rebuilt as a comparison page';
    } else if (PAGE_SLUGS.has(path)) {
      decision = 'keep';
      reason = 'Already a page at this slug (guide, specialty or listicle)';
    } else if (cls === 'keep' && specialty) {
      decision = 'merge';
      target = specialty[1];
      reason = 'Specialty-software post competing with the specialty page (research note)';
    } else if (cls === 'keep') {
      reason = 'Answers a buyer question or ranks; refresh with author and date';
    } else if (cls === 'merge') {
      target = specialty?.[1] ?? '/ai/';
      reason = 'Near-duplicate AI explainer (spec 3.6: one post per topic)';
    } else if (cls === 'drop') {
      target = '410';
      reason = 'Frontier-technology post with no buyer intent (spec 3.6)';
    } else if (proposal) {
      usedProposals.add(path);
      decision = proposal.decision.trim();
      target = proposal.target.trim();
      ownerPage = proposal.owner.trim();
      reason = `${PROPOSAL_NOTE} ${proposal.reason.trim()}`;
    } else {
      decision = 'review';
      reason = 'Needs a human decision with Search Console data';
    }
    let changed = false;
    const hold = held.get(path);
    if (hold && decision === 'keep') {
      usedHolds.add(path);
      changed = true;
      decision = 'merge';
      target = hold.final_target;
      ownerPage = '';
      reason = `${HELD_NOTE} ${hold.reason.trim()}`;
    } else if (proposal && decision === 'merge' && held.has(normalizePath(target))) {
      const via = normalizePath(target);
      const final = held.get(via)!.final_target;
      if (final === path) {
        console.error(`  ✗ ${path}: the proposal merges into ${via}, which is held and resolves back to ${path}; nothing written.`);
        process.exit(1);
      }
      changed = true;
      target = final;
      reason = `${reason} Re-pointed: the proposed target ${via} is held in the ${TRIAGE_DATE} refresh and merges into ${final}.`;
      repointed.push(`${path}: ${via} -> ${final}`);
    }
    rows.push([path, title, decision, target, ownerPage ?? (decision === 'keep' ? owner : ''), reason, confirmedFor(path, decision, target, changed)]);
  }
}
writeFileSync('migration/posts-manifest.csv', stringifyCsv(rows));
const count = (d: string) => rows.filter((r) => r[2] === d).length;
console.log(`posts: ${rows.length - 1}  keep: ${count('keep')}  merge: ${count('merge')}  drop: ${count('drop')}  review: ${count('review')}`);
console.log(`review rows decided from ${PROPOSALS_CSV}: ${usedProposals.size}`);
const unused = [...proposals.keys()].filter((p) => !usedProposals.has(p));
if (unused.length) console.warn(`  ! ${unused.length} proposals match no review row (ignored): ${unused.join(', ')}`);
console.log(`held posts from ${TRIAGE_CSV} turned into merge proposals: ${usedHolds.size} of ${held.size}`);
const unusedHolds = [...held.keys()].filter((p) => !usedHolds.has(p));
if (unusedHolds.length) console.warn(`  ! ${unusedHolds.length} held posts have no "keep" row to turn into a merge (left as they are): ${unusedHolds.join(', ')}`);
console.log(`review proposals re-pointed because their target is held: ${repointed.length}`);
for (const r of repointed) console.log(`  - ${r}`);
if (droppedConfirmations.length) {
  console.warn(`  ! ${droppedConfirmations.length} confirmations cleared because the proposal changed; marketing confirms again:`);
  for (const d of droppedConfirmations) console.warn(`    ${d}`);
}
if (!existsSync('migration/posts-manifest.csv')) process.exit(1);
