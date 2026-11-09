/**
 * Results per post: GA4 and Search Console, 28 days against the previous 28. No Google SDK: a service-account JWT
 * signed with node:crypto. Sources and every edge-case decision: docs/research/admin-insights-edge-cases.md.
 *
 * Nothing here throws to the page and no Google error text or token leaves this file: failures become one of the
 * plain messages in FAILURE_MESSAGES.
 */
import { createSign } from 'node:crypto';
import { GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_JSON, SEARCH_CONSOLE_SITE } from 'astro:env/server';

export const EVENT_CTA = 'cta_click';
export const EVENT_WHATSAPP = 'whatsapp_click';
/** Fires on /demo/confirmation/, so it is counted by landing page, not page path (see the research doc). */
export const EVENT_DEMO = 'demo_form_submitted';

const SITE_HOSTS = new Set(['www.easyclinic.io', 'easyclinic.io']);
const WINDOW_DAYS = 28;
const SEARCH_FALLBACK_DELAY_DAYS = 3;
const SEARCH_STALE_AFTER_DAYS = 7;
const CACHE_MS = 15 * 60_000;
const FAILURE_CACHE_MS = 5 * 60_000;
const GA_PAGE_SIZE = 10_000;
const GA_MAX_PAGES = 10;
const SEARCH_PAGE_SIZE = 25_000;
const SEARCH_MAX_PAGES = 2; // 50,000 rows a day is Search Console's documented limit.
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly';

/* ---------- Pure: paths, change, merge ---------- */

export interface InsightPost {
  slug: string;
  path: string;
  title: string;
}
export interface PathCount {
  path: string;
  count: number;
}
export interface PathEvent extends PathCount {
  event: string;
}
export interface GaPeriod {
  views: PathCount[];
  events: PathEvent[];
  /** null when Google refused the landing-page query; the rest of the report still stands. */
  demos: PathCount[] | null;
}
export interface SearchRow {
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}
export interface MergeInput {
  posts: InsightPost[];
  ga: { current: GaPeriod; previous: GaPeriod } | null;
  search: { current: SearchRow[]; previous: SearchRow[] } | null;
}
/** null means the source was not available; 0 means it answered and there was nothing to count. */
export interface InsightRow extends InsightPost {
  views: number | null;
  viewsPrevious: number | null;
  viewsChange: number | null;
  clicks: number | null;
  clicksPrevious: number | null;
  clicksChange: number | null;
  impressions: number | null;
  position: number | null;
  ctaClicks: number | null;
  whatsappClicks: number | null;
  demoRequests: number | null;
  demoRequestsPrevious: number | null;
}

/** Every form of a URL reduced to `/slug/`. null for other hosts and for GA4's `(not set)`. */
export function normalizePagePath(value: string): string | null {
  const raw = value.trim();
  if (!raw || raw.startsWith('(')) return null;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (!SITE_HOSTS.has(url.hostname.toLowerCase())) return null;
      path = url.pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/')) return null;
  path = path.split(/[?#]/)[0].replace(/\/{2,}/g, '/').toLowerCase();
  return path.endsWith('/') ? path : `${path}/`;
}

/** Whole percent. null when there is no previous value to compare with: never divides by zero. */
export function changePercent(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function sumByPath(rows: PathCount[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of rows) {
    const path = normalizePagePath(row.path);
    if (path) out.set(path, (out.get(path) ?? 0) + row.count);
  }
  return out;
}

/** Sums URL variants of one page; position is re-averaged, weighted by impressions. */
function mergeSearch(rows: SearchRow[]): Map<string, { clicks: number; impressions: number; position: number | null }> {
  const acc = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const row of rows) {
    const path = normalizePagePath(row.page);
    if (!path) continue;
    const entry = acc.get(path) ?? { clicks: 0, impressions: 0, weighted: 0 };
    entry.clicks += row.clicks;
    entry.impressions += row.impressions;
    entry.weighted += row.position * row.impressions;
    acc.set(path, entry);
  }
  return new Map(
    [...acc].map(([path, e]) => [path, { clicks: e.clicks, impressions: e.impressions, position: e.impressions > 0 ? e.weighted / e.impressions : null }]),
  );
}

const eventsOf = (events: PathEvent[], name: string) => sumByPath(events.filter((e) => e.event === name));

/** Pure. One row per post, most demo requests first. */
export function mergeInsights({ posts, ga, search }: MergeInput): InsightRow[] {
  const views = ga && sumByPath(ga.current.views);
  const viewsPrevious = ga && sumByPath(ga.previous.views);
  const cta = ga && eventsOf(ga.current.events, EVENT_CTA);
  const whatsapp = ga && eventsOf(ga.current.events, EVENT_WHATSAPP);
  const demos = ga?.current.demos ? sumByPath(ga.current.demos) : null;
  const demosPrevious = ga?.previous.demos ? sumByPath(ga.previous.demos) : null;
  const current = search && mergeSearch(search.current);
  const previous = search && mergeSearch(search.previous);

  const rows = posts.map((post): InsightRow => {
    const path = normalizePagePath(post.path) ?? post.path;
    const count = (map: Map<string, number> | null) => (map ? (map.get(path) ?? 0) : null);
    const v = count(views);
    const vp = count(viewsPrevious);
    const c = current ? (current.get(path)?.clicks ?? 0) : null;
    const cp = previous ? (previous.get(path)?.clicks ?? 0) : null;
    return {
      ...post,
      views: v,
      viewsPrevious: vp,
      viewsChange: changePercent(v, vp),
      clicks: c,
      clicksPrevious: cp,
      clicksChange: changePercent(c, cp),
      impressions: current ? (current.get(path)?.impressions ?? 0) : null,
      position: current?.get(path)?.position ?? null,
      ctaClicks: count(cta),
      whatsappClicks: count(whatsapp),
      demoRequests: count(demos),
      demoRequestsPrevious: count(demosPrevious),
    };
  });
  return rows.sort(
    (a, b) =>
      (b.demoRequests ?? 0) - (a.demoRequests ?? 0) ||
      (b.ctaClicks ?? 0) + (b.whatsappClicks ?? 0) - ((a.ctaClicks ?? 0) + (a.whatsappClicks ?? 0)) ||
      (b.views ?? 0) - (a.views ?? 0) ||
      a.title.localeCompare(b.title),
  );
}

/* ---------- Pure: date windows ---------- */

export interface DateWindow {
  startDate: string;
  endDate: string;
}
export interface Windows {
  current: DateWindow;
  previous: DateWindow;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Two adjacent windows of 28 days, the current one ending on `end` inclusive. */
export function windowsEndingOn(end: string): Windows {
  return {
    current: { startDate: addDays(end, -(WINDOW_DAYS - 1)), endDate: end },
    previous: { startDate: addDays(end, -(2 * WINDOW_DAYS - 1)), endDate: addDays(end, -WINDOW_DAYS) },
  };
}

/* ---------- Client ---------- */

export type FailureCode = 'config' | 'auth' | 'permission' | 'quota' | 'unavailable' | 'unexpected';

export const FAILURE_MESSAGES: Record<FailureCode, string> = {
  config: 'GOOGLE_SERVICE_ACCOUNT_JSON could not be read. Paste the whole key file from Google Cloud again.',
  auth: 'Google refused the service account. Its key may be deleted or disabled: create a new key in Google Cloud and update GOOGLE_SERVICE_ACCOUNT_JSON.',
  permission: 'Google says the service account has no access. Check it is still a user on this property and that the API is enabled.',
  quota: 'Google’s usage limit is reached for now. Try again in 15 minutes.',
  unavailable: 'Google did not respond. Try again in a few minutes.',
  unexpected: 'Google sent an answer this page could not use. Check the property settings in the admin guide.',
};

export class InsightsError extends Error {
  readonly code: FailureCode;
  constructor(code: FailureCode) {
    super(FAILURE_MESSAGES[code]);
    this.name = 'InsightsError';
    this.code = code;
  }
}

export interface InsightsConfig {
  serviceAccountJson?: string;
  ga4PropertyId?: string;
  searchConsoleSite?: string;
}
export interface InsightsDeps {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}
export interface InsightsData {
  ga: MergeInput['ga'];
  search: MergeInput['search'];
  gaWindows: Windows | null;
  searchWindows: Windows | null;
  /** Plain sentences for the page. */
  warnings: string[];
}

export function parseServiceAccount(json: string | undefined): { email: string; privateKey: string } {
  try {
    const parsed = JSON.parse(json ?? '') as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') throw new Error('shape');
    return { email: parsed.client_email, privateKey: parsed.private_key.replace(/\\n/g, '\n') };
  } catch {
    throw new InsightsError('config');
  }
}

const b64url = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export function signJwt(email: string, privateKey: string, nowSeconds: number): string {
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ iss: email, scope: SCOPES, aud: TOKEN_URL, iat: nowSeconds, exp: nowSeconds + 3600 }),
  )}`;
  try {
    return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url')}`;
  } catch {
    throw new InsightsError('config');
  }
}

interface GaResponse {
  rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
  rowCount?: number;
  metadata?: { dataLossFromOtherRow?: boolean; samplingMetadatas?: unknown[]; subjectToThresholding?: boolean };
}
interface SearchResponse {
  rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; position?: number }>;
}

const failureOf = (error: unknown): FailureCode => (error instanceof InsightsError ? error.code : 'unexpected');

/** Testable core: all I/O comes in through `deps`. */
export function createInsightsClient(config: InsightsConfig, deps: InsightsDeps = {}) {
  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let token: { value: string; expiresAt: number } | null = null;
  let tokenRequest: Promise<string> | null = null;

  async function send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await doFetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new InsightsError('unavailable');
    }
  }

  /** Parallel reports share one token request. */
  function getToken(): Promise<string> {
    if (token && token.expiresAt > now()) return Promise.resolve(token.value);
    tokenRequest ??= requestToken().finally(() => {
      tokenRequest = null;
    });
    return tokenRequest;
  }

  async function requestToken(): Promise<string> {
    const { email, privateKey } = parseServiceAccount(config.serviceAccountJson);
    const response = await send(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signJwt(email, privateKey, Math.floor(now() / 1000)),
      }).toString(),
    });
    if (response.status >= 500) throw new InsightsError('unavailable');
    if (!response.ok) throw new InsightsError('auth');
    const body = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
    if (!body?.access_token) throw new InsightsError('auth');
    token = { value: body.access_token, expiresAt: now() + ((body.expires_in ?? 3600) - 60) * 1000 };
    return token.value;
  }

  /** One new token on a 401, one retry on 500 or 503, none on quota. */
  async function postJson<T>(url: string, body: unknown): Promise<T> {
    let refreshed = false;
    let retried = false;
    for (;;) {
      const response = await send(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${await getToken()}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        try {
          return (await response.json()) as T;
        } catch {
          throw new InsightsError('unexpected');
        }
      }
      if (response.status === 401 && !refreshed) {
        refreshed = true;
        token = null;
        continue;
      }
      if ((response.status === 500 || response.status === 503) && !retried) {
        retried = true;
        await sleep(400);
        continue;
      }
      if (response.status === 401) throw new InsightsError('auth');
      if (response.status === 429) throw new InsightsError('quota');
      if (response.status === 403) {
        // Search Console documents the words "quota exceeded" but not a status.
        const text = await response.text().catch(() => '');
        throw new InsightsError(/quota|rate.?limit/i.test(text) ? 'quota' : 'permission');
      }
      if (response.status >= 500) throw new InsightsError('unavailable');
      throw new InsightsError('unexpected');
    }
  }

  async function runReport(window: DateWindow, dimensions: string[], metric: string, events: string[] | null, warnings: Set<string>) {
    const property = (config.ga4PropertyId ?? '').replace(/^properties\//, '');
    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(property)}:runReport`;
    const rows: NonNullable<GaResponse['rows']> = [];
    for (let page = 0; ; page++) {
      const response = await postJson<GaResponse>(url, {
        dateRanges: [window],
        dimensions: dimensions.map((name) => ({ name })),
        metrics: [{ name: metric }],
        limit: GA_PAGE_SIZE,
        offset: page * GA_PAGE_SIZE,
        ...(events ? { dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: events } } } } : {}),
      });
      rows.push(...(response.rows ?? []));
      if (response.metadata?.dataLossFromOtherRow) warnings.add('Google grouped some rare pages into “(other)”, so low-traffic posts may read low.');
      if (response.metadata?.samplingMetadatas?.length) warnings.add('Google sampled some of this analytics data, so counts are estimates.');
      if (response.metadata?.subjectToThresholding) warnings.add('Google may have withheld very small analytics counts.');
      const total = response.rowCount ?? 0;
      if (rows.length >= total || !response.rows?.length) return rows;
      if (page + 1 >= GA_MAX_PAGES) {
        warnings.add('Analytics returned more rows than this page reads, so some posts may read low.');
        return rows;
      }
    }
  }

  const value = (cell: { value?: string } | undefined) => cell?.value ?? '';
  const number = (cell: { value?: string } | undefined) => Number(cell?.value ?? 0) || 0;

  async function gaPeriod(window: DateWindow, warnings: Set<string>): Promise<GaPeriod> {
    const [views, events, demos] = await Promise.allSettled([
      runReport(window, ['pagePath'], 'screenPageViews', null, warnings),
      runReport(window, ['pagePath', 'eventName'], 'eventCount', [EVENT_CTA, EVENT_WHATSAPP], warnings),
      runReport(window, ['landingPage'], 'eventCount', [EVENT_DEMO], warnings),
    ]);
    if (views.status === 'rejected') throw views.reason;
    if (events.status === 'rejected') throw events.reason;
    if (demos.status === 'rejected') warnings.add(`Demo requests are not available. ${FAILURE_MESSAGES[failureOf(demos.reason)]}`);
    return {
      views: views.value.map((r) => ({ path: value(r.dimensionValues?.[0]), count: number(r.metricValues?.[0]) })),
      events: events.value.map((r) => ({ path: value(r.dimensionValues?.[0]), event: value(r.dimensionValues?.[1]), count: number(r.metricValues?.[0]) })),
      demos: demos.status === 'fulfilled' ? demos.value.map((r) => ({ path: value(r.dimensionValues?.[0]), count: number(r.metricValues?.[0]) })) : null,
    };
  }

  const searchUrl = () => `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.searchConsoleSite ?? '')}/searchAnalytics/query`;

  async function latestSearchDate(today: string): Promise<string | null> {
    const response = await postJson<SearchResponse>(searchUrl(), {
      startDate: addDays(today, -10),
      endDate: today,
      dimensions: ['date'],
      type: 'web',
      rowLimit: 25,
    });
    const dates = (response.rows ?? []).map((r) => r.keys?.[0]).filter((d): d is string => typeof d === 'string');
    return dates.length ? dates.sort().at(-1)! : null;
  }

  async function searchPages(window: DateWindow, warnings: Set<string>): Promise<SearchRow[]> {
    const rows: SearchRow[] = [];
    for (let page = 0; ; page++) {
      const response = await postJson<SearchResponse>(searchUrl(), {
        ...window,
        dimensions: ['page'],
        type: 'web',
        rowLimit: SEARCH_PAGE_SIZE,
        startRow: page * SEARCH_PAGE_SIZE,
      });
      const batch = response.rows ?? [];
      for (const r of batch) {
        rows.push({ page: r.keys?.[0] ?? '', clicks: r.clicks ?? 0, impressions: r.impressions ?? 0, position: r.position ?? 0 });
      }
      if (batch.length < SEARCH_PAGE_SIZE) return rows;
      if (page + 1 >= SEARCH_MAX_PAGES) {
        warnings.add('Search Console returned its row limit, so some posts may read low.');
        return rows;
      }
    }
  }

  /** Never rejects: a failed source becomes null plus a warning, and the other source still shows. */
  async function load(): Promise<InsightsData> {
    const warnings = new Set<string>();
    const today = new Date(now()).toISOString().slice(0, 10);

    const loadGa = async () => {
      if (!config.ga4PropertyId) return { ga: null, gaWindows: null };
      try {
        const gaWindows = windowsEndingOn(addDays(today, -1));
        const [current, previous] = await Promise.all([gaPeriod(gaWindows.current, warnings), gaPeriod(gaWindows.previous, warnings)]);
        return { ga: { current, previous }, gaWindows };
      } catch (error) {
        warnings.add(`Analytics: ${FAILURE_MESSAGES[failureOf(error)]}`);
        return { ga: null, gaWindows: null };
      }
    };
    const loadSearch = async () => {
      if (!config.searchConsoleSite) return { search: null, searchWindows: null };
      try {
        const latest = await latestSearchDate(today);
        if (latest && addDays(latest, SEARCH_STALE_AFTER_DAYS) < today) warnings.add(`Search Console’s newest data is from ${latest}, older than usual.`);
        if (!latest) warnings.add('Search Console has no data for the last 10 days. A newly added property can take up to a week.');
        const searchWindows = windowsEndingOn(latest ?? addDays(today, -SEARCH_FALLBACK_DELAY_DAYS));
        const [current, previous] = await Promise.all([searchPages(searchWindows.current, warnings), searchPages(searchWindows.previous, warnings)]);
        return { search: { current, previous }, searchWindows };
      } catch (error) {
        warnings.add(`Search Console: ${FAILURE_MESSAGES[failureOf(error)]}`);
        return { search: null, searchWindows: null };
      }
    };

    const [ga, search] = await Promise.all([loadGa(), loadSearch()]);
    return { ...ga, ...search, warnings: [...warnings] };
  }

  return { load };
}

/* ---------- Wiring to the environment ---------- */

const envConfig = (): InsightsConfig => ({
  serviceAccountJson: GOOGLE_SERVICE_ACCOUNT_JSON,
  ga4PropertyId: GA4_PROPERTY_ID,
  searchConsoleSite: SEARCH_CONSOLE_SITE,
});

/** The settings still needed, by name. Empty when everything is set. */
export function missingSettings(config: InsightsConfig = envConfig()): string[] {
  return [
    !config.serviceAccountJson && 'GOOGLE_SERVICE_ACCOUNT_JSON',
    !config.ga4PropertyId && 'GA4_PROPERTY_ID',
    !config.searchConsoleSite && 'SEARCH_CONSOLE_SITE',
  ].filter((name): name is string => Boolean(name));
}

/** True when the key and at least one of the two properties are set. */
export function isConfigured(config: InsightsConfig = envConfig()): boolean {
  return Boolean(config.serviceAccountJson && (config.ga4PropertyId || config.searchConsoleSite));
}

let client: ReturnType<typeof createInsightsClient> | null = null;
let cached: { at: number; ttl: number; data: Promise<InsightsData> } | null = null;

/** Cached in memory per server instance. Failures are kept for less time, and Google's error budget is not spent on reloads. */
export function getInsightsData(): Promise<InsightsData> {
  const now = Date.now();
  if (cached && now - cached.at < cached.ttl) return cached.data;
  client ??= createInsightsClient(envConfig());
  const entry = {
    at: now,
    ttl: CACHE_MS,
    data: client.load().then((data) => {
      if (data.warnings.some((w) => Object.values(FAILURE_MESSAGES).some((m) => w.includes(m)))) entry.ttl = FAILURE_CACHE_MS;
      return data;
    }),
  };
  cached = entry;
  return entry.data;
}
