import { createHash } from 'node:crypto';
import { parse, stringify } from 'yaml';
import type { PostContent } from './types.ts';

const FENCED = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Splits an MDX file. The body keeps every byte after the closing fence. */
export function parsePost(raw: string): PostContent {
  const match = FENCED.exec(raw);
  if (!match) throw new Error('The file has no frontmatter block.');
  const frontmatter: unknown = parse(match[1]);
  if (typeof frontmatter !== 'object' || frontmatter === null || Array.isArray(frontmatter)) {
    throw new Error('The frontmatter is not a set of fields.');
  }
  return { frontmatter: frontmatter as Record<string, unknown>, body: raw.slice(match[0].length) };
}

/** YAML 1.2 keeps 2026-09-27 a plain string, so dates stay unquoted. */
export function serializePost(content: PostContent): string {
  const yaml = stringify(content.frontmatter, { lineWidth: 0, aliasDuplicateObjects: false });
  return `---\n${yaml}---\n${content.body}`;
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (typeof value !== 'object' || value === null) return value;
  const source = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(source).sort().map((key) => [key, sorted(source[key])]));
}

/** Keys are sorted first: the same content always hashes the same, whatever order storage returns it in. */
export function hashContent(content: PostContent): string {
  const canonical = serializePost({ frontmatter: sorted(content.frontmatter) as Record<string, unknown>, body: content.body });
  return createHash('sha256').update(canonical).digest('hex');
}
