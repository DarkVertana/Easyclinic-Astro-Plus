/**
 * Builds migration/posts-manifest.csv: every live blog post with its research class, a PROPOSED
 * decision and target (spec 3.6: prune ~403 posts to ~120, each owned by a landing page). Marketing
 * confirms the decisions before any redirect or 410 is generated from this file.
 *
 * Usage: node scripts/posts-manifest.ts
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseCsv } from './lib/csv.ts';

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

const rows = [['path', 'research_class', 'proposed_decision', 'target', 'owner_page', 'reason', 'confirmed']];
for (const [title, cls] of classes) {
  for (const path of section(title)) {
    const specialty = SPECIALTY.find(([prefixes]) => matches(path, prefixes) && matches(path, ['software', 'management', 'emr', 'system', 'automation']));
    const owner = OWNERS.find(([prefixes]) => matches(path, prefixes))?.[1] ?? '/blog/';
    let decision = cls;
    let target = path;
    let reason = '';
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
    } else {
      decision = 'review';
      reason = 'Needs a human decision with Search Console data';
    }
    rows.push([path, title, decision, target, decision === 'keep' ? owner : '', reason, confirmedByPath.get(path) ?? '']);
  }
}
const csv = rows.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
writeFileSync('migration/posts-manifest.csv', `${csv}\n`);
const count = (d: string) => rows.filter((r) => r[2] === d).length;
console.log(`posts: ${rows.length - 1}  keep: ${count('keep')}  merge: ${count('merge')}  drop: ${count('drop')}  review: ${count('review')}`);
if (!existsSync('migration/posts-manifest.csv')) process.exit(1);
