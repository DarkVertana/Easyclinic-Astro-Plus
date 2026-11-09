/** Plain data shapes the Astro pages pass to the React islands. */
import type { PostRow } from '../../../lib/admin/lifecycle';
import type { DiffLine } from './format';
import type { Check, HistoryEvent, Role } from '../../../lib/admin/types';

export type NavId = 'dashboard' | 'posts' | 'approvals' | 'generate' | 'insights';

export interface FrameData {
  user: { name: string; email: string; role: Role };
  current: NavId;
  waiting: number;
  flash: { message: string; kind: 'success' | 'error' | 'info' } | null;
  /** Comma-separated slugs just trashed: adds Undo to the banner. */
  undo: string | null;
  q: string;
}

export type RowData = Omit<PostRow, 'status' | 'updated'> & { updated: string | null };

export interface CompareData {
  beforeLabel: string;
  afterLabel: string;
  changed: Array<{ label: string; from: string; to: string }>;
  lines: DiffLine[];
}

export interface Option {
  value: string;
  label: string;
}

export type { Check, HistoryEvent };

export interface EvidenceData {
  sources: Array<{ id: string; url: string; title: string; host: string; tier: string }>;
  claims: Array<{ id: string; sourceId: string; statement: string; quote: string }>;
  rejectedClaims: Array<{ id: string; statement: string; quote: string }>;
  checks: Check[];
  reviewFindings: Check[];
}

export interface EditorFields {
  h1: string; body: string; author: string; topic: string; owner: string; summary: string; openingAnswer: string; linkLabel: string;
  headKeyword: string; title: string; metaDescription: string; faq: Array<{ question: string; answer: string }>;
  ctaPrimaryLabel: string; ctaPrimaryHref: string; ctaSecondaryLabel: string; ctaSecondaryHref: string; whatsapp: string;
}
