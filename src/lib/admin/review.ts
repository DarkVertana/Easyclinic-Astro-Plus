/**
 * What an approver is shown of a post's frontmatter. Generic on purpose: a field added to the schema appears here
 * without anyone remembering to add it, so nothing can be published unseen.
 */
import { linkTargets } from './harness.ts';

export interface FieldRow {
  path: string;
  label: string;
  value: string;
  /** The value is, or contains, a link that leaves this site. */
  external: boolean;
}

const WORDS: Record<string, string> = { ctas: 'Calls to action', faq: 'FAQ', h1: 'H1', href: 'Address', whatsapp: 'WhatsApp message', hub: 'Hub', related: 'Related' };

function wordsOf(key: string): string {
  if (WORDS[key]) return WORDS[key];
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function fieldLabel(path: string): string {
  return path
    .split('.')
    .map((part) => {
      const [, name, index] = /^(.*?)(?:\[(\d+)\])?$/.exec(part)!;
      return index === undefined ? wordsOf(name) : `${wordsOf(name)} ${Number(index) + 1}`;
    })
    .join(', ');
}

export const isExternalLink = (target: string): boolean => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target.trim()) && !/^(?:mailto|tel):/i.test(target.trim());

function externalIn(value: string): boolean {
  return isExternalLink(value) || linkTargets(value).some((link) => isExternalLink(link.target));
}

/** Every leaf of the frontmatter, in file order. An empty value still gets a row. */
export function flattenFields(value: unknown, path = ''): FieldRow[] {
  if (Array.isArray(value) && value.length) return value.flatMap((item, i) => flattenFields(item, `${path}[${i}]`));
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && Object.keys(value).length) {
    return Object.entries(value).flatMap(([key, item]) => flattenFields(item, path ? `${path}.${key}` : key));
  }
  const text = value === null || value === undefined || value === '' || (typeof value === 'object' && !(value instanceof Date)) ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return [{ path, label: fieldLabel(path), value: text, external: externalIn(text) }];
}

/** Set by approving, so a change there says nothing about what the editor did. */
const NOT_EDITS = new Set(['status', 'lastUpdated', 'editorialPass']);

/** A sentence for each field that differs between the file on main and this submission. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
  const values = (fm: Record<string, unknown>) => new Map(flattenFields(fm).filter((row) => !NOT_EDITS.has(row.path.split('.')[0])).map((row) => [row.path, row]));
  const a = values(before);
  const b = values(after);
  const out: string[] = [];
  for (const [path, row] of b) {
    if (!a.has(path)) {
      if (row.value) out.push(`${row.label} added: ${row.value}`);
    } else if (a.get(path)!.value !== row.value) {
      out.push(`${row.label} changed: ${row.value || 'now empty'}`);
    }
  }
  for (const [path, row] of a) if (!b.has(path) && row.value) out.push(`${row.label} removed (was: ${row.value})`);
  return out;
}
