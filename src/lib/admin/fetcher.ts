/**
 * Reads pages for the research ledger. Every URL here came from the open web, so the fetcher assumes hostile input:
 * https only, public addresses only (checked again at connection time, which is what stops DNS rebinding), redirects
 * re-checked hop by hop, and robots.txt per RFC 9309. Sources for these rules: docs/research/admin-engine-edge-cases.md.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import { lookup as dnsLookupCb } from 'node:dns';
import { BlockList, isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { parse as parseHtml } from 'node-html-parser';
import type { Source } from './types.ts';

export const USER_AGENT = 'EasyClinicBlogResearch/1.0';
const ROBOTS_TOKEN = 'easyclinicblogresearch';
const MAX_REDIRECTS = 3;
const ROBOTS_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;
const ROBOTS_MAX_BYTES = 500 * 1024;
const MAX_TEXT = 40_000;
const MIN_TEXT = 500;
const ROBOTS_TTL_MS = 24 * 3600 * 1000;
export const MIN_QUOTE_CHARS = 20;

/**
 * Competitor domains, from the vendors named in src/content/comparisons, alternatives and listicles. A post must not
 * cite or lean on a competitor's marketing. Review sites and government hosts cited on those pages are not competitors.
 */
export const BLOCKED_HOSTS: readonly string[] = [
  'adroitinfosystems.com', 'ajirmed.com', 'clinicea.com', 'clinikehr.com', 'carewellinternational.net', 'clinicsoftware.ae',
  'docengage.in', 'doctorsapp.in', 'eka.care', 'ekascribe.ai', 'focussoftnet.com', 'gnuhealth.org', 'goodx.co.za', 'healthplix.com',
  'healthray.com', 'healthtechghana.com', 'heliumhealth.com', 'hyella.com', 'instahms.com', 'kenyahmis.org', 'kicowebdesign.com',
  'ksatria.io', 'kumodoc.com', 'medassolutions.com', 'medicalmet.com', 'medicasimple.com', 'medinous.com', 'mocal.ai', 'mocdoc.com',
  'netwalkers.ng', 'open-emr.org', 'openmrs.org', 'opensource-technology.com', 'pabau.com', 'practo.com', 'remedi.my', 'riomed.com',
  'smarthospitalmanager.com', 'softclinicsoftware.com', 'softnetsolutions.com.fj', 'streamlinehealth.org', 'tenwavehealthcare.com',
  'unite.care', 'uniteemr.com', 'usecarelogic.com', 'yolo.clinic', 'zandahealth.com',
];

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
export const isBlockedHost = (host: string) => BLOCKED_HOSTS.some((d) => hostMatches(host.toLowerCase(), d));

/* ---------- Addresses ---------- */

const DENY = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) DENY.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) DENY.addSubnet(net, bits, 'ipv6');

/** True for anything not a globally routable unicast address. An unparseable address counts as private. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return DENY.check(address, 'ipv4');
  if (version === 6) return DENY.check(address.split('%')[0], 'ipv6');
  return true;
}

const FORBIDDEN_NAME = /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|corp|localdomain|onion|arpa)$/i;
const METADATA_NAMES = new Set(['metadata.google.internal', 'metadata.amazonaws.com', 'instance-data']);

export type RejectReason =
  | 'bad-url' | 'not-https' | 'ip-literal' | 'private-host' | 'private-address' | 'blocked-host' | 'dns-failed'
  | 'robots-disallowed' | 'too-many-redirects' | 'http-error' | 'paywall' | 'unsupported-type' | 'too-large' | 'timeout'
  | 'thin-content' | 'not-english' | 'network';

export class UrlRejected extends Error {
  constructor(readonly reason: RejectReason, message: string) {
    super(message);
    this.name = 'UrlRejected';
  }
}

/** Syntax and name checks. URL parsing normalises decimal, hex and octal hosts to dotted form, so they land on the IP rule. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlRejected('bad-url', `Not a URL: ${raw.slice(0, 80)}`);
  }
  if (url.protocol !== 'https:') throw new UrlRejected('not-https', `Only https is fetched: ${url.protocol}`);
  if (url.username || url.password) throw new UrlRejected('bad-url', 'URLs with credentials are refused');
  if (url.port && url.port !== '443') throw new UrlRejected('bad-url', `Non-standard port ${url.port}`);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') || isIP(host)) throw new UrlRejected('ip-literal', `IP addresses are refused: ${host}`);
  if (!host.includes('.') || FORBIDDEN_NAME.test(host) || METADATA_NAMES.has(host)) throw new UrlRejected('private-host', `Private host name: ${host}`);
  if (/[^\x00-\x7f]/.test(raw.split('/')[2] ?? '') ) throw new UrlRejected('bad-url', 'Non-ASCII host names are refused');
  if (isBlockedHost(host)) throw new UrlRejected('blocked-host', `Competitor domain: ${host}`);
  return url;
}

/* ---------- Transport ---------- */

export interface RawResponse {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
  truncated: boolean;
}

export interface FetcherDeps {
  /** Every address a name resolves to. */
  resolve: (host: string) => Promise<string[]>;
  request: (url: URL, maxBytes: number) => Promise<RawResponse>;
  now: () => number;
  wait: (ms: number) => Promise<void>;
}

/** Connects only to an address validated in this lookup, while TLS and Host keep the original name (OWASP SSRF). */
const pinnedLookup = ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
  dnsLookupCb(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err);
    const bad = addresses.find((a) => isPrivateAddress(a.address));
    if (bad || addresses.length === 0) return callback(new UrlRejected('private-address', `${hostname} resolves to a private address`));
    if (options.all) callback(null, addresses);
    else callback(null, addresses[0].address, addresses[0].family);
  });
}) as never;

function defaultRequest(url: URL, maxBytes: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(url, {
      method: 'GET',
      lookup: pinnedLookup,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain;q=0.9', 'accept-encoding': 'identity' },
      timeout: TIMEOUT_MS,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
      const finish = (truncated: boolean) => resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks), truncated });
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy();
          finish(true);
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => finish(false));
      res.on('error', reject);
    });
    const deadline = setTimeout(() => req.destroy(new UrlRejected('timeout', `Timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS);
    req.on('timeout', () => req.destroy(new UrlRejected('timeout', `Timed out after ${TIMEOUT_MS / 1000}s`)));
    req.on('error', reject);
    req.on('close', () => clearTimeout(deadline));
    req.end();
  });
}

const defaults: FetcherDeps = {
  resolve: async (host) => (await dnsLookup(host, { all: true })).map((a) => a.address),
  request: defaultRequest,
  now: () => Date.now(),
  wait: (ms) => new Promise((r) => setTimeout(r, ms)),
};

async function assertResolvesPublic(url: URL, deps: FetcherDeps): Promise<void> {
  let addresses: string[];
  try {
    addresses = await deps.resolve(url.hostname);
  } catch {
    throw new UrlRejected('dns-failed', `Could not resolve ${url.hostname}`);
  }
  if (addresses.length === 0) throw new UrlRejected('dns-failed', `No address for ${url.hostname}`);
  const bad = addresses.find(isPrivateAddress);
  if (bad) throw new UrlRejected('private-address', `${url.hostname} resolves to private address ${bad}`);
}

async function safeGet(raw: string, deps: FetcherDeps, maxBytes: number, maxRedirects: number): Promise<{ response: RawResponse; finalUrl: URL }> {
  let current = assertSafeUrl(raw);
  for (let hop = 0; ; hop++) {
    await assertResolvesPublic(current, deps);
    const response = await deps.request(current, maxBytes);
    if (response.status < 300 || response.status >= 400 || !response.headers.location) return { response, finalUrl: current };
    if (hop >= maxRedirects) throw new UrlRejected('too-many-redirects', `More than ${maxRedirects} redirects from ${raw.slice(0, 80)}`);
    current = assertSafeUrl(new URL(response.headers.location, current).toString());
  }
}

/* ---------- robots.txt (RFC 9309) ---------- */

export interface RobotsRule {
  allow: boolean;
  path: string;
}

/** The rules that apply to our token: all matching groups combined, else the `*` groups (RFC 9309 2.2.1). */
export function parseRobots(text: string, token = ROBOTS_TOKEN): RobotsRule[] {
  const ours: RobotsRule[] = [];
  const star: RobotsRule[] = [];
  let sawOurs = false;
  let agents: string[] = [];
  let inRules = false;
  for (const line of text.split(/\r\n|\r|\n/)) {
    const m = /^\s*([A-Za-z-]+)\s*:\s*([^#]*?)\s*(?:#.*)?$/.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (key === 'user-agent') {
      if (inRules) {
        agents = [];
        inRules = false;
      }
      const agent = m[2].toLowerCase().match(/^[a-z_-]+|^\*/)?.[0] ?? '';
      agents.push(agent);
      if (agent === token) sawOurs = true;
    } else if (key === 'allow' || key === 'disallow') {
      inRules = true;
      if (!m[2]) continue;
      const rule = { allow: key === 'allow', path: m[2] };
      if (agents.includes(token)) ours.push(rule);
      if (agents.includes('*')) star.push(rule);
    }
  }
  return sawOurs ? ours : star;
}

const encodePath = (path: string) =>
  path.replace(/[^\x21-\x7e]/g, (c) => encodeURIComponent(c)).replace(/%[0-9a-f]{2}/gi, (e) => e.toUpperCase());

function ruleMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = encodePath(anchored ? pattern.slice(0, -1) : pattern);
  // Each `*` piece taken at its leftmost match. No backtracking, so a hostile robots.txt cannot stall the fetcher.
  const parts = body.split('*');
  const first = parts[0];
  if (!path.startsWith(first)) return false;
  if (parts.length === 1) return !anchored || path === first;
  let at = first.length;
  const last = parts.length - 1;
  for (let i = 1; i < last; i++) {
    const found = path.indexOf(parts[i], at);
    if (found === -1) return false;
    at = found + parts[i].length;
  }
  return anchored ? path.length - parts[last].length >= at && path.endsWith(parts[last]) : path.indexOf(parts[last], at) !== -1;
}

/** Longest match wins, measured in octets; on a tie, allow (RFC 9309 2.2.2). */
export function robotsAllows(rules: RobotsRule[], pathAndQuery: string): boolean {
  const path = encodePath(pathAndQuery);
  if (path === '/robots.txt') return true;
  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (!ruleMatches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return best ? best.allow : true;
}

const DENY_ALL: RobotsRule[] = [{ allow: false, path: '/' }];
const robotsCache = new Map<string, { rules: RobotsRule[]; at: number }>();
export const clearRobotsCache = () => robotsCache.clear();

async function rulesFor(origin: string, deps: FetcherDeps): Promise<RobotsRule[]> {
  const cached = robotsCache.get(origin);
  if (cached && deps.now() - cached.at < ROBOTS_TTL_MS) return cached.rules;
  let rules: RobotsRule[];
  try {
    const { response } = await safeGet(`${origin}/robots.txt`, deps, ROBOTS_MAX_BYTES, ROBOTS_REDIRECTS);
    if (response.status >= 200 && response.status < 300) rules = parseRobots(new TextDecoder().decode(response.body));
    // 4xx means "unavailable" and the RFC lets us crawl. 429 is a request to slow down, so we take it as a no.
    else if (response.status >= 400 && response.status < 500 && response.status !== 429) rules = [];
    else rules = DENY_ALL;
  } catch {
    rules = DENY_ALL;
  }
  robotsCache.set(origin, { rules, at: deps.now() });
  return rules;
}

/* ---------- Extraction ---------- */

const REMOVE = 'script,style,noscript,template,nav,footer,header,aside,form,svg,iframe,object,embed,button,select,[hidden],[aria-hidden="true"]';
const BLOCK = /<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|blockquote|table|ul|ol|dd|dt|figure|figcaption|pre)>|<br\s*\/?>/gi;

export interface Extracted {
  title: string;
  text: string;
  publishedAt: string | null;
  lang: string;
}

function parseDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Block tags become line breaks, inline tags vanish, so a sentence with a <b> in the middle stays one sentence and a
 * quote can span the markup. Elements a reader does not see are removed first, which also drops hidden injection text.
 */
export function extractText(html: string): Extracted {
  const root = parseHtml(html, { comment: false });
  const title = root.querySelector('title')?.text.trim() ?? root.querySelector('h1')?.text.trim() ?? '';
  const metaDate =
    root.querySelector('meta[property="article:modified_time"]')?.getAttribute('content') ??
    root.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ??
    root.querySelector('meta[name="date"]')?.getAttribute('content') ??
    root.querySelector('time[datetime]')?.getAttribute('datetime');
  const lang = root.querySelector('html')?.getAttribute('lang')?.toLowerCase().split('-')[0] ?? '';
  root.querySelectorAll(REMOVE).forEach((el) => el.remove());
  for (const el of root.querySelectorAll('[style]')) {
    if (/display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0/i.test(el.getAttribute('style') ?? '')) el.remove();
  }
  const main = root.querySelector('main') ?? root.querySelector('article') ?? root.querySelector('body') ?? root;
  const flattened = parseHtml(main.innerHTML.replace(BLOCK, (m) => `${m}\n`)).text;
  const text = flattened.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, MAX_TEXT);
  return { title: title.replace(/\s+/g, ' ').slice(0, 200), text, publishedAt: parseDate(metaDate), lang };
}

const WALL = /\b(?:subscribe to (?:continue|read)|to continue reading|sign in to (?:continue|read)|enable javascript|javascript is (?:required|disabled)|please enable cookies|verify you are (?:a )?human|just a moment|access denied|purchase (?:this article|access)|members only)\b/i;
const EN_STOPWORDS = new Set(['the', 'of', 'and', 'to', 'in', 'is', 'that', 'for', 'it', 'with', 'as', 'on', 'are', 'was', 'be', 'this', 'by', 'from', 'or', 'an', 'at', 'which', 'not', 'have', 'has']);

export function looksEnglish(text: string, lang = ''): boolean {
  if (lang && lang !== 'en') return false;
  const sample = text.slice(0, 8000);
  const letters = sample.match(/\p{L}/gu)?.length ?? 0;
  const latin = sample.match(/\p{Script=Latin}/gu)?.length ?? 0;
  if (letters === 0 || latin / letters < 0.7) return false;
  const tokens = sample.toLowerCase().match(/\p{L}+/gu) ?? [];
  return tokens.filter((t) => EN_STOPWORDS.has(t)).length / Math.max(tokens.length, 1) > 0.15;
}

/* ---------- Tiers and quotes ---------- */

const OFFICIAL = /(?:^|\.)(?:gov|gov\.[a-z]{2}|go\.[a-z]{2}|gob\.[a-z]{2}|nic\.in|mohfw\.nic\.in|nmc\.org\.in|who\.int|cdsco\.gov\.in|abdm\.gov\.in|nabh\.co|dha\.gov\.ae|doh\.gov\.ae|mohap\.gov\.ae|fda\.gov|ema\.europa\.eu|europa\.eu|un\.org|worldbank\.org)$/;
const RESEARCH = /(?:^|\.)(?:nih\.gov|ncbi\.nlm\.nih\.gov|thelancet\.com|nejm\.org|bmj\.com|nature\.com|sciencedirect\.com|springer\.com|wiley\.com|jamanetwork\.com|plos\.org|arxiv\.org|cochrane\.org|biomedcentral\.com|frontiersin\.org|ac\.[a-z]{2}|edu)$/;
const NEWS = /(?:^|\.)(?:reuters\.com|apnews\.com|bbc\.co\.uk|bbc\.com|thehindu\.com|indianexpress\.com|livemint\.com|economictimes\.indiatimes\.com|timesofindia\.indiatimes\.com|business-standard\.com|nation\.africa|standardmedia\.co\.ke|theeastafrican\.co\.ke|thenationalnews\.com|khaleejtimes\.com)$/;

export function classifyTier(host: string): Source['tier'] {
  const h = host.toLowerCase();
  if (RESEARCH.test(h)) return 'research';
  if (OFFICIAL.test(h)) return 'official';
  if (NEWS.test(h)) return 'news';
  return 'other';
}

function normalizeForQuote(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[­​-‍⁠﻿]/g, '')
    .replace(/\[\d{1,3}\]/g, '')
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Exact after normalising what typography and markup change. Short fragments prove nothing, and an ellipsis is an edit. */
export function quoteAppearsIn(quote: string, text: string): boolean {
  const q = normalizeForQuote(quote).replace(/^["']|["']$/g, '');
  if (q.length < MIN_QUOTE_CHARS || q.split(' ').length < 4 || /\.\.\.|…/.test(q)) return false;
  return normalizeForQuote(text).includes(q);
}

/* ---------- fetchSource ---------- */

export type FetchResult =
  | { ok: true; url: string; title: string; host: string; tier: Source['tier']; text: string; fetchedAt: string; publishedAt: string | null }
  | { ok: false; url: string; reason: RejectReason; detail: string };

export async function fetchSource(url: string, overrides: Partial<FetcherDeps> = {}): Promise<FetchResult> {
  const deps = { ...defaults, ...overrides };
  const fail = (reason: RejectReason, detail: string): FetchResult => ({ ok: false, url, reason, detail });
  try {
    const parsed = assertSafeUrl(url);
    if (/\.pdf(?:$|\?)/i.test(parsed.pathname + parsed.search)) return fail('unsupported-type', 'PDF sources are not read; find the HTML version or add the fact by hand');
    await assertResolvesPublic(parsed, deps);
    const rules = await rulesFor(parsed.origin, deps);
    if (!robotsAllows(rules, parsed.pathname + parsed.search)) return fail('robots-disallowed', `robots.txt disallows ${USER_AGENT}`);

    const { response, finalUrl } = await safeGet(url, deps, MAX_BYTES, MAX_REDIRECTS);
    if (finalUrl.origin !== parsed.origin) {
      const finalRules = await rulesFor(finalUrl.origin, deps);
      if (!robotsAllows(finalRules, finalUrl.pathname + finalUrl.search)) return fail('robots-disallowed', `robots.txt on ${finalUrl.host} disallows ${USER_AGENT}`);
    }
    if ([401, 402, 403, 451].includes(response.status)) return fail('paywall', `HTTP ${response.status}: the page is closed to us`);
    if (response.status !== 200) return fail('http-error', `HTTP ${response.status}`);
    if (response.truncated) return fail('too-large', `Larger than ${MAX_BYTES / 1024 / 1024} MB`);

    const type = (response.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    const head = new TextDecoder('latin1').decode(response.body.slice(0, 5));
    if (head.startsWith('%PDF') || type === 'application/pdf') return fail('unsupported-type', 'PDF sources are not read; find the HTML version or add the fact by hand');
    if (type !== 'text/html' && type !== 'application/xhtml+xml' && type !== 'text/plain') return fail('unsupported-type', `Content type ${type || 'missing'}`);

    const charset = /charset=([\w-]+)/i.exec(response.headers['content-type'] ?? '')?.[1] ?? 'utf-8';
    let decoded: string;
    try {
      decoded = new TextDecoder(charset).decode(response.body);
    } catch {
      decoded = new TextDecoder().decode(response.body);
    }
    const extracted: Extracted = type === 'text/plain' ? { title: finalUrl.pathname, text: decoded.slice(0, MAX_TEXT), publishedAt: null, lang: '' } : extractText(decoded);
    if (extracted.text.length < MIN_TEXT) {
      const wall = WALL.test(extracted.text);
      return fail(wall ? 'paywall' : 'thin-content', wall ? 'The page shows a wall, not its content' : `Only ${extracted.text.length} characters of text: probably a JavaScript-only page`);
    }
    if (WALL.test(extracted.text.slice(0, 600)) && extracted.text.length < 3000) return fail('paywall', 'The page shows a wall, not its content');
    if (!looksEnglish(extracted.text, extracted.lang)) return fail('not-english', 'Not in English: an approver could not check the quotes');
    return {
      ok: true,
      url: finalUrl.toString(),
      title: extracted.title,
      host: finalUrl.hostname,
      tier: classifyTier(finalUrl.hostname),
      text: extracted.text,
      fetchedAt: new Date(deps.now()).toISOString(),
      publishedAt: extracted.publishedAt,
    };
  } catch (err) {
    if (err instanceof UrlRejected) return fail(err.reason, err.message);
    return fail('network', err instanceof Error ? err.message : String(err));
  }
}
