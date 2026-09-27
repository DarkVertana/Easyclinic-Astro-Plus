/**
 * Walks a content entry's data and yields every string and every unknown fact (null), with a
 * dotted path for error messages. Keys holding URLs, ids and machine values are skipped, and so are the
 * editor-only keys (UNRENDERED_KEYS: `notes`, `editorNote`), which are never rendered.
 */
import { UNRENDERED_KEYS } from '../../schemas/constants.ts';

export type Leaf =
  | { kind: 'string'; path: string; key: string; value: string; verbatim: boolean; isCtaLabel: boolean }
  | { kind: 'null'; path: string; key: string }
  | { kind: 'missing-media'; path: string; key: string; needed?: string };

const SKIP_KEYS = new Set([
  'href',
  'src',
  'url',
  'videoUrl',
  'link',
  'linkedin',
  'photo',
  'canonical',
  'schemaExtras',
  'discriminant',
  'icon',
  'event',
  'id',
  'collection',
  'status',
  'family',
  'path',
  'redirectFrom',
  'headKeyword',
  'secondaryKeywords',
  ...UNRENDERED_KEYS,
  'currency',
  'country',
  'kind',
  'frame',
  'tone',
  'variant',
  'layout',
  'plan',
  'period',
  'figure',
  'figures',
  'persona',
  'personas',
  'hub',
  'editorialPass',
  'claimsReview',
  'source',
  'needed',
]);

const VERBATIM_KEYS = new Set(['quote', 'pullQuote']);

function isReference(value: Record<string, unknown>): boolean {
  const keys = Object.keys(value);
  return keys.length === 2 && keys.includes('collection') && keys.includes('id');
}

function isMedia(value: Record<string, unknown>): boolean {
  return 'alt' in value && 'kind' in value && 'frame' in value;
}

export function* walk(value: unknown, path = '', key = '', parentIsCta = false): Generator<Leaf> {
  if (value === null) {
    yield { kind: 'null', path, key };
    return;
  }
  if (value === undefined || value instanceof Date || typeof value === 'number' || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    yield {
      kind: 'string',
      path,
      key,
      value,
      verbatim: VERBATIM_KEYS.has(key),
      isCtaLabel: parentIsCta && key === 'label',
    };
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walk(value[i], `${path}[${i}]`, key, parentIsCta);
    return;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (isReference(obj)) return;
    if (isMedia(obj) && !obj.src && !obj.videoUrl) {
      yield { kind: 'missing-media', path, key, needed: typeof obj.needed === 'string' ? obj.needed : undefined };
    }
    const isCta = key === 'primary' || key === 'secondary' || key === 'cta' || /ctas?$/i.test(key);
    for (const [k, v] of Object.entries(obj)) {
      if (SKIP_KEYS.has(k)) continue;
      yield* walk(v, path ? `${path}.${k}` : k, k, isCta);
    }
  }
}
