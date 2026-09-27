import { describe, expect, it } from 'vitest';
import { POST_TOPICS } from '../../src/schemas/constants.ts';
import { auditEntry } from '../../src/lib/rules/audit.ts';
import { bodyWordCount, groupByTopic, indexTopic, readingMinutes, summaryRepeatsOpening, toIndexItem, type IndexItem, type Listable } from '../../src/lib/content/posts.ts';
import { labelTableCells } from '../../src/lib/content/post-table.ts';
import {
  cleanHtml,
  cutWithin,
  decode,
  demoHrefFor,
  firstHeadingText,
  firstSentences,
  htmlToMdx,
  keywordFrom,
  leadText,
  linkLabelFrom,
  mdxSafe,
  repeatsTitle,
  sentencesWithin,
  splitSentences,
  summaryFrom,
  topicForOwner,
  topicForPost,
} from '../../scripts/lib/wp-convert.ts';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

describe('reading time', () => {
  it('rounds posts up at 200 words a minute', () => {
    expect(readingMinutes(words(200), 'post')).toBe(1);
    expect(readingMinutes(words(201), 'post')).toBe(2);
    expect(readingMinutes('', 'post')).toBe(1);
    expect(readingMinutes(undefined, 'post')).toBe(1);
  });
  it('keeps the guide figure the guide template has always shown', () => {
    expect(readingMinutes(words(300), 'guide')).toBe(1);
    expect(readingMinutes(words(330), 'guide')).toBe(2);
    expect(readingMinutes(words(1100), 'guide')).toBe(5);
  });
  it('counts only the words a reader sees', () => {
    const body = [
      "import X from './x';",
      '## A heading here',
      'Read [the guide](/clinic-in-india/) now.',
      '<InlineCta heading="Setting up" href="/kenyademo/" label="Book">',
      'One two.',
      '</InlineCta>',
      '| Cost | Amount |',
      '| --- | --- |',
      '| Rent | 100 |',
      '![A photo](./images/a.png)',
    ].join('\n');
    // A heading here (3) + Read the guide now (4) + One two (2) + Cost Amount Rent 100 (4)
    expect(bodyWordCount(body)).toBe(13);
  });
});

describe('post summary on the page', () => {
  it('is hidden when it only repeats the opening answer', () => {
    expect(summaryRepeatsOpening(undefined, 'Anything.')).toBe(true);
    expect(summaryRepeatsOpening('At first, the plan looks simple.', 'At first, the plan looks simple. A doctor finds a room.')).toBe(true);
    expect(summaryRepeatsOpening('At first, the plan looks…', 'At first, the plan looks simple.')).toBe(true);
  });
  it('is hidden when it runs on from the opening answer', () => {
    // An imported draft: both cut from the first paragraph, the summary a little longer.
    expect(summaryRepeatsOpening('A patient walks in. The doctor is qualified. The records are secure.', 'A patient walks in. The doctor is qualified.')).toBe(true);
  });
  it('shows when it says something the opening does not', () => {
    expect(summaryRepeatsOpening('What a clinic in Pune costs to open.', 'A clinic in Pune costs ₹8 lakh to open.')).toBe(false);
  });
});

const page = (over: Omit<Partial<Listable>, 'data'> & { data?: Partial<Listable['data']> }): Listable => ({
  path: '/x/',
  family: 'post',
  status: 'published',
  entry: { body: words(10) },
  ...over,
  data: { h1: 'Title', metaDescription: 'Meta', lastUpdated: new Date('2026-09-01'), links: {}, topic: 'billing-and-claims', ...over.data },
});

describe('the /blog/ index', () => {
  it('lists posts under their topic and start-a-clinic guides under start-a-clinic', () => {
    expect(indexTopic(page({}))).toBe('billing-and-claims');
    expect(indexTopic(page({ family: 'guide', data: { links: { hub: '/start-a-clinic/' }, topic: undefined } }))).toBe('start-a-clinic');
    expect(indexTopic(page({ family: 'guide', data: { links: { hub: '/compare/' }, topic: undefined } }))).toBeNull();
    expect(indexTopic(page({ family: 'feature' }))).toBeNull();
    expect(indexTopic(page({ data: { topic: 'not-a-topic' } }))).toBeNull();
  });
  it('uses the H1, the summary (or meta description) and the reading time', () => {
    const item = toIndexItem(page({ data: { h1: 'How to open', summary: 'Short summary' } }))!;
    expect(item).toMatchObject({ title: 'How to open', summary: 'Short summary', minutes: 1, topic: 'billing-and-claims' });
    expect(toIndexItem(page({}))!.summary).toBe('Meta');
  });
  it('groups by topic in order, newest first, and leaves empty topics out', () => {
    const item = (title: string, topic: IndexItem['topic'], date: string | null): IndexItem => ({ path: `/${title}/`, title, summary: '', date: date ? new Date(date) : null, minutes: 1, topic, status: 'published' });
    const groups = groupByTopic([
      item('old', 'start-a-clinic', '2025-01-01'),
      item('undated', 'start-a-clinic', null),
      item('new', 'start-a-clinic', '2026-09-26'),
      item('claims', 'billing-and-claims', '2026-01-01'),
    ]);
    expect(groups.map((g) => g.topic)).toEqual(['billing-and-claims', 'start-a-clinic']);
    expect(groups[1].items.map((i) => i.title)).toEqual(['new', 'old', 'undated']);
    // A custom order puts its topics first; the rest follow in the default order.
    expect(groupByTopic(groups.flatMap((g) => g.items), ['start-a-clinic']).map((g) => g.topic)).toEqual(['start-a-clinic', 'billing-and-claims']);
  });
});

describe('post publish rules', () => {
  it('rejects /blog/ as the owner of a post', () => {
    const issues = auditEntry({ owner: '/blog/' } as never, 'post');
    expect(issues.some((i) => i.rule === 'owner' && i.severity === 'error')).toBe(true);
    expect(auditEntry({ owner: '/features/billing/' } as never, 'post').some((i) => i.rule === 'owner')).toBe(false);
  });
});

describe('WordPress import: owner and topic', () => {
  it('maps the owner page to a /blog/ topic', () => {
    expect(topicForOwner('/features/emr/')).toBe('switching-to-emr');
    expect(topicForOwner('/solutions/clinic-chain/')).toBe('running-a-chain');
    expect(topicForOwner('/trust/')).toBe('compliance-by-country');
    expect(topicForOwner('/ai/')).toBe('cura-ai');
    expect(topicForOwner('/features/insurance-claims/')).toBe('billing-and-claims');
    expect(topicForOwner('/features/whatsapp/')).toBe('patient-engagement');
    expect(topicForOwner('/emr-software-in-kenya/')).toBe('start-a-clinic');
    expect(topicForOwner('/clinic-management-software-india/')).toBe('start-a-clinic');
    expect(topicForOwner('/features/lab/')).toBe('running-a-clinic');
    expect(topicForOwner('/blog/')).toBe('running-a-clinic');
    for (const owner of ['/features/pharmacy-and-inventory/', '/start-a-clinic/']) expect(POST_TOPICS).toContain(topicForOwner(owner));
  });
  it('takes a provisional topic from the slug and title when /blog/ owns the post', () => {
    const topic = (slug: string, title: string) => topicForPost('/blog/', slug, title);
    expect(topic('clinic-in-malaysia', 'How to Start a Clinic in Malaysia in 2025')).toEqual({ topic: 'start-a-clinic', provisional: true });
    expect(topic('clinic-in-rwanda', 'From Licensing to Profit: The Real Guide to Starting a Clinic in Rwanda').topic).toBe('start-a-clinic');
    expect(topic('clinic-software-migration', 'Escape Legacy System Nightmares').topic).toBe('switching-to-emr');
    expect(topic('medical-transcription-software', 'AI Transcription and the Virtual Clinical Assistant').topic).toBe('cura-ai');
    expect(topic('simplifying-healthcare-financing', 'NHIS Integration, Insurance Billing').topic).toBe('billing-and-claims');
    expect(topic('consistent-patient-experiences-across-multiple-clinic-sites', 'Consistent Patient Experiences Across Multiple Clinic Sites').topic).toBe('running-a-chain');
    expect(topic('simplifying-ethiopias-healthcare-supply-chain', 'The Healthcare Supply Chain').topic).toBe('running-a-clinic');
    expect(topic('healthcare-in-uganda', 'How Teleconsultation Is Saving Lives in Rural Uganda').topic).toBe('patient-engagement');
    expect(topic('securing-your-clinic', 'User Access Control Simplified').topic).toBe('running-a-clinic');
    // A real owner decides the topic, whatever the title says.
    expect(topicForPost('/features/billing/', 'x', 'How to Start a Clinic')).toEqual({ topic: 'billing-and-claims', provisional: false });
  });
  it('routes the demo call to action to the country demo page', () => {
    expect(demoHrefFor('nhif-in-kenya')).toBe('/kenyademo/');
    expect(demoHrefFor('clinic-setup-cost-in-india')).toBe('/indiademo/');
    expect(demoHrefFor('whatever', '/emr-software-in-kenya/')).toBe('/kenyademo/');
    expect(demoHrefFor('clinic-cash-flow')).toBe('/contact-us/#book-a-demo');
  });
});

describe('WordPress import: text', () => {
  it('decodes rendered titles and excerpts', () => {
    expect(decode('<p>Don&#8217;t pay &amp; wait&nbsp;[&hellip;]</p>')).toBe('Don’t pay & wait […]');
    expect(decode('Patients 24&#215;7 &#x2013; always')).toBe('Patients 24×7 – always');
  });
  it('ends sentences only where one ends, and never drops text', () => {
    expect(firstSentences('Costs rose 2.5 times. Then fell.', 2, 400)).toBe('Costs rose 2.5 times. Then fell.');
    expect(firstSentences('It’s 7:30 a.m. at a busy clinic in Hyderabad. The waiting room fills. Then more.', 2, 400)).toBe('It’s 7:30 a.m. at a busy clinic in Hyderabad. The waiting room fills.');
    expect(summaryFrom('It’s 7:30 a.m. at a busy clinic in Hyderabad, and the waiting room already fills with patients. Revenue grew 2.5 times last year.')).toMatch(/^It’s 7:30 a\.m\. at/);
    expect(firstSentences('See Dr. Rao at easyclinic.io today. Fees start at Rs. 500. Book now.', 2, 400)).toBe('See Dr. Rao at easyclinic.io today. Fees start at Rs. 500.');
    const text = 'One (e.g. this). “Two?” Three! 4 is a number. A tail with no stop';
    const { sentences, rest } = splitSentences(text);
    expect(sentences).toEqual(['One (e.g. this).', '“Two?”', 'Three!', '4 is a number.']);
    expect([...sentences, rest].join(' ')).toBe(text);
  });
  it('cuts at sentence boundaries, or at a word when no sentence fits', () => {
    expect(sentencesWithin('One. Two is longer. Three.', 20)).toBe('One. Two is longer.');
    expect(sentencesWithin('A very long first sentence that goes on.', 20)).toBe('A very long first…');
    expect(cutWithin('Short. Then a much longer second sentence that does not fit at all.', 40, 30)).toBe('Short. Then a much longer second…');
  });
  it('builds a link label of at most 48 characters and a head keyword', () => {
    expect(linkLabelFrom('The Essential RCM Guide: Mastering Revenue Cycle Management')).toBe('The Essential RCM Guide');
    const label = linkLabelFrom('Smarter Scheduling, Happier Patients and Better Healthcare Operations Through Optimized Appointments');
    expect(label.length).toBeLessThanOrEqual(48);
    expect(label).not.toMatch(/\s(?:and|the)$/);
    expect(keywordFrom('How AI and UPI Are Getting Clinics Paid Faster In 2026?')).toBe('how ai and upi are getting clinics paid faster');
  });
  it('takes the lead from the post when the excerpt is the automatic one', () => {
    expect(leadText('A manual summary.', '<p>Body.</p>')).toBe('A manual summary.');
    expect(leadText('Title words First words […]', '<p>First words here.</p><p>Second.</p>')).toBe('First words here. Second.');
  });
  it('stops the lead at the first heading after the opening text', () => {
    const intro = 'Whether you run one clinic or several, an EMR is the best way to keep records. Read on:';
    expect(leadText('x […]', `<p>${intro}</p><h2>Question 1</h2><p>It automates the records.</p>`)).toBe(intro);
    // Bare text (no <p>) counts, and a heading before any text does not stop the lead.
    const bare = '<h2>A guide</h2>Understanding the <strong>rules</strong> is crucial for any doctor who wants to practise legally here.<h3>Steps</h3><p>Later.</p>';
    expect(leadText('A guide Understanding the rules […]', bare)).toBe('Understanding the rules is crucial for any doctor who wants to practise legally here.');
    // An opening shorter than a meta description runs on into the next section.
    expect(leadText('x […]', '<p>Short intro.</p><h2>One</h2><p>More text that follows the heading.</p>')).toBe('Short intro. More text that follows the heading.');
    // No text at all: the automatic excerpt without the heading it runs into.
    expect(leadText('A Guide to Kenya Understanding the rules […]', '<ul><li>Only a list</li></ul>', 'A Guide to Kenya')).toBe('Understanding the rules […]');
    expect(firstHeadingText('<p>x</p><h2 class="a">A <b>Guide</b></h2>')).toBe('A Guide');
  });
});

describe('WordPress import: HTML clean-up', () => {
  it('strips inline styles, data attributes, empty paragraphs, share widgets and tables of contents', () => {
    const html = cleanHtml(
      [
        '<h2>Repeats the title</h2>',
        '<p style="color:red" data-start="1" class="x">Intro <span style="font-weight:400">text</span>.</p>',
        '<p>&nbsp;</p>',
        '<p><strong>Table of Contents</strong></p><ul><li><a href="#a">A</a></li><li><a href="#b">B</a></li></ul>',
        '<div class="sharedaddy sd-sharing-enabled"><a href="https://x.com/share">Share</a></div>',
        '<ul><li><a href="#a">A</a></li><li><a href="#b">B</a></li><li><a href="#c">C</a></li></ul>',
        '<h2 id="a" style="x"><b>A section</b></h2>',
        '<p><a href="https://www.easyclinic.io/features/emr">EMR</a> and <a href="https://example.com/?utm_source=chatgpt.com">a source</a></p>',
      ].join(''),
      new Map(),
      'This heading repeats the title',
    );
    expect(html).not.toMatch(/style=|data-start|class=|Table of Contents|Share|Repeats the title|href="#/);
    expect(html).not.toMatch(/<p>\s*<\/p>/);
    expect(html).toContain('<h2>A section</h2>');
    expect(html).toContain('href="/features/emr/"');
    expect(html).toContain('href="https://example.com/"');
  });
  it('points links at the staging IP back at the site and tidies URL link text', () => {
    const md = htmlToMdx(cleanHtml('<p>See <a href="http://143.198.231.228/features">http://143.198.231.228/features/<br></a> and <a href="https://easyclinic.io/pricing/">the prices</a>.</p>'));
    expect(md).toBe('See [www.easyclinic.io/features/](/features/) and [the prices](/pricing/).');
  });
  it('drops an opening heading only when it repeats the title', () => {
    expect(repeatsTitle('A Guide to Registration and Licensing Requirements for Doctors in Kenya', 'What Are the Registration and Licensing Requirements for Doctors in Kenya')).toBe(true);
    expect(repeatsTitle('1. Introduction', 'AI Allergy Clinic Software')).toBe(false);
    expect(repeatsTitle('Why Clinics Are Struggling with Manual Management?', 'EasyClinic EMR Software in India')).toBe(false);
    const md = (html: string) => htmlToMdx(cleanHtml(html, new Map(), 'AI Surgery Clinic Software'));
    expect(md('<h2>1. Introduction</h2><p>Text.</p><h2>2. Next</h2><p>More.</p>')).toMatch(/^## 1\\. Introduction/);
    expect(md('<h2>AI surgery clinic software</h2><p>Text.</p>')).toBe('Text.');
    expect(md('<h1>Anything at all</h1><p>Text.</p>')).toBe('Text.');
    // Text before the heading: it is a section, whatever it says.
    expect(md('Some bare text.<h2>AI Surgery Clinic Software</h2><p>More.</p>')).toContain('## AI Surgery Clinic Software');
  });
  it('starts headings at h2 and never skips a level', () => {
    const levels = (html: string) => [...htmlToMdx(cleanHtml(`<p>Intro.</p>${html}`)).matchAll(/^(#+) /gm)].map((m) => m[1].length);
    expect(levels('<h3>A</h3><p>x</p><h3>B</h3><p>x</p><h4>B1</h4><p>x</p>')).toEqual([2, 2, 3]);
    expect(levels('<h2>A</h2><p>x</p><h4>A1</h4><p>x</p><h4>A2</h4><p>x</p><h2>B</h2>')).toEqual([2, 3, 3, 2]);
    expect(levels('<h4>A</h4><p>x</p><h2>B</h2><p>x</p><h5>B1</h5>')).toEqual([2, 2, 3]);
  });
  it('turns a pasted empty Markdown link into a labelled source link', () => {
    const md = htmlToMdx(cleanHtml('<p>MCF lends to clinics.</p><p>[](https://www.medicalcreditfund.org/who-are-we/)</p>'));
    expect(md).toBe('MCF lends to clinics.\n\nSource: [medicalcreditfund.org](https://www.medicalcreditfund.org/who-are-we/)');
  });
  it('moves extra <thead> rows into the body so each rule appears once', () => {
    const md = htmlToMdx(
      cleanHtml('<p>Intro.</p><table><thead><tr><td><strong>Feature</strong></td><td>Description</td></tr><tr><td>EMR</td><td>Links billing</td></tr><tr><td>Portal</td><td>Pay bills</td></tr></thead><tbody><tr><td>Last</td><td>Row</td></tr></tbody></table>'),
    );
    expect(md).toContain('| **Feature** | Description |\n| --- | --- |\n| EMR | Links billing |\n| Portal | Pay bills |\n| Last | Row |');
    expect(md.match(/\| --- \|/g)).toHaveLength(1);
    // With no <tbody> at all, one is made.
    const noBody = htmlToMdx(cleanHtml('<p>Intro.</p><table><thead><tr><th>A</th></tr><tr><td>1</td></tr></thead></table>'));
    expect(noBody).toContain('| A |\n| --- |\n| 1 |');
  });
  it('gives every table a header row so it converts to a GFM table', () => {
    const md = htmlToMdx(cleanHtml('<p>Intro.</p><table><tbody><tr><td>Item</td><td>Cost</td></tr><tr><td>Rent<br>monthly</td><td>1 | 2</td></tr></tbody></table>'));
    expect(md).toContain('| Item | Cost |\n| --- | --- |\n| Rent monthly | 1 \\| 2 |');
  });
  it('turns headings inside list items into bold lead-ins and never emits an H1', () => {
    const md = htmlToMdx(cleanHtml('<p>Intro.</p><h1>Big</h1><ul><li><h5>Point</h5><p>Detail.</p></li></ul>'));
    expect(md).toContain('## Big');
    expect(md).toContain('- **Point**');
    expect(md).not.toMatch(/^# /m);
  });
  it('drops images that were not downloaded and points kept ones at the local copy', () => {
    const src = 'https://www.easyclinic.io/wp-content/uploads/a.png';
    const kept = cleanHtml(`<p>x</p><img src="data:image/svg+xml,x" data-lazy-src="${src}" alt="A">`, new Map([[src, './images/a.png']]));
    expect(kept).toContain('src="./images/a.png"');
    expect(cleanHtml(`<p>x</p><img src="${src}" alt="A">`)).not.toContain('<img');
  });
  it('labels post table cells with their column header for the stacked layout', () => {
    const html = labelTableCells('<thead><tr><th style="text-align:left">Item</th><th>Cost &amp; "fees"</th></tr></thead><tbody><tr><td>Rent</td><td><strong>100</strong></td></tr><tr><td>Staff</td></tr></tbody>');
    expect(html).toContain('<thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader" style="text-align:left">Item</th>');
    // "100" is the Cost column's only amount, so that column is also marked numeric (post-table.test.ts covers the rule).
    expect(html).toContain('<th scope="col" role="columnheader" data-numeric>Cost &amp; "fees"</th>');
    expect(html).toContain('<tbody role="rowgroup"><tr role="row"><td role="cell" data-label="Item">Rent</td><td role="cell" data-label="Cost &amp; &quot;fees&quot;" data-numeric><strong>100</strong></td></tr>');
    expect(html).toContain('<tr role="row"><td role="cell" data-label="Item">Staff</td></tr>');
  });
  it('escapes MDX syntax outside code', () => {
    expect(mdxSafe('a {b} <c> `{keep}`')).toBe('a \\{b\\} &lt;c> `{keep}`');
    expect(mdxSafe('import this line')).toBe('&#105;mport this line');
  });
});
