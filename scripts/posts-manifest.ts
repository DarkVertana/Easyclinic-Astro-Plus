/**
 * Builds migration/posts-manifest.csv: every live blog post with its research class, a PROPOSED
 * decision and target (spec 3.6: prune ~403 posts to ~120, each owned by a landing page). Marketing
 * confirms the decisions before any redirect or 410 is generated from this file.
 *
 * Usage: node scripts/posts-manifest.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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

/** Owning landing page by topic (spec 3.6: each kept post is owned by a landing page). */
const OWNERS: Array<[RegExp, string]> = [
  [/whatsapp/, '/features/whatsapp/'],
  [/no-show|appointment|scheduling|booking/, '/features/appointment-scheduling/'],
  [/billing|invoice|cash-flow|fraud|gst/, '/features/billing/'],
  [/claim|payor|insurance|tpa/, '/features/insurance-claims/'],
  [/revenue|leak|break-even|financial/, '/features/revenue-management/'],
  [/pharmac|inventory|stock/, '/features/pharmacy-and-inventory/'],
  [/lab|patholog/, '/features/lab/'],
  [/telemedicine|teleconsult|telehealth|virtual/, '/features/telehealth/'],
  [/engagement|retention|recall|feedback|referral/, '/features/patient-engagement/'],
  [/dashboard|report|kpi|analytics/, '/features/reports-and-dashboards/'],
  [/chain|multi-location|branch/, '/solutions/clinic-chain/'],
  [/compliance|abdm|privacy|legal|hipaa|dpdp/, '/trust/'],
  [/emr|paperless|records|prescription/, '/features/emr/'],
  [/kenya|nairobi|kmpdc|sha/, '/emr-software-in-kenya/'],
  [/nigeria|lagos/, '/hospital-management-software-nigeria/'],
  [/dubai|uae/, '/clinic-management-software-uae/'],
  [/india|mumbai|delhi|tier-2/, '/clinic-management-software-india/'],
  [/clinic-setup|start|profitable|opening|launch/, '/start-a-clinic/'],
  [/\bai\b|ai-|artificial/, '/ai/'],
];
/** Specialty-software posts compete with the specialty pages (research note): merge into them. */
const SPECIALTY: Array<[RegExp, string]> = [
  [/dental|dentist|orthodont/, '/dental-emr-software/'],
  [/dermat|skin|cosmet|aesthetic|trich/, '/dermatology-emr-software/'],
  [/paediat|pediat|child/, '/pediatric-emr/'],
  [/cardio/, '/cardiology-emr/'],
  [/psychiat|mental|psycholog/, '/mental-health/'],
  [/ophthal|eye/, '/ophthalmology-emr/'],
  [/ortho/, '/orthopedic-emr/'],
  [/gynae|gyne|obgyn|obstet/, '/obgyn-emr-software/'],
  [/ivf|fertility/, '/ivf-emr/'],
  [/physio/, '/physiotherapy-clinic-management-software/'],
  [/ayurved/, '/ayurveda-clinic-management-software/'],
  [/ent-|otolaryng/, '/ent-emr-software/'],
  [/neuro/, '/neurology-emr/'],
];
const imported = new Set(['/the-ultimate-guide-to-starting-a-clinic-in-kenya/', '/how-do-i-get-approval-from-the-kmpdc-in-kenya/', '/how-much-does-it-cost-to-open-a-clinic-in-nairobi/', '/clinic-in-uganda/', '/clinic-in-india/', '/how-much-does-it-cost-to-open-a-clinic-in-mumbai/', '/clinic-in-nigeria/', '/clinic-in-ethiopia/', '/how-to-get-approval-from-the-medical-practitioners-and-dentists-council-in-india-nmc-dci/', '/patient-data-privacy-laws-in-india/']);
const comparisonPages = new Set(['/easyclinic-vs-practo/', '/easyclinic-vs-healthplix/', '/easyclinic-vs-kenyaemr/', '/easyclinic-emr-vs-traditional-emr/']);

const rows = [['path', 'research_class', 'proposed_decision', 'target', 'owner_page', 'reason']];
for (const [title, cls] of classes) {
  for (const path of section(title)) {
    const specialty = SPECIALTY.find(([re]) => re.test(path) && /software|clinic-management|emr|system|automation/.test(path));
    const owner = OWNERS.find(([re]) => re.test(path))?.[1] ?? '/blog/';
    let decision = cls;
    let target = path;
    let reason = '';
    if (imported.has(path)) {
      decision = 'keep';
      reason = 'Imported as a start-a-clinic guide';
    } else if (comparisonPages.has(path)) {
      decision = 'keep';
      reason = 'Rebuilt as a comparison page';
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
    rows.push([path, title, decision, target, decision === 'keep' ? owner : '', reason]);
  }
}
const csv = rows.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
writeFileSync('migration/posts-manifest.csv', `${csv}\n`);
const count = (d: string) => rows.filter((r) => r[2] === d).length;
console.log(`posts: ${rows.length - 1}  keep: ${count('keep')}  merge: ${count('merge')}  drop: ${count('drop')}  review: ${count('review')}`);
if (!existsSync('migration/posts-manifest.csv')) process.exit(1);
