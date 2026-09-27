import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import {
  FIELD_META,
  boolOrText,
  choice,
  choices,
  date,
  optionalChoice,
  path,
  preserved,
  ref,
  text,
  unknown,
  unknownChoice,
  unknownFlag,
  unknownList,
} from '../../keystatic/fields.ts';
import { cta, isoDate, optionalCta, optionalGroup, unknown as zUnknown } from '../../src/schemas/fields.ts';
import { CTA_PRESENT_IF, blankGroupsToUndefined, hasValue } from '../../src/schemas/groups.ts';

// Keystatic hands a field `undefined` for both a missing key and a stored null (toFormFieldStoredValue in 0.6.9).
const STORED_NULL = undefined;

/** True when Keystatic would refuse to save the value (any throw from validate marks it invalid). */
const invalid = (field: { validate: (...args: any[]) => unknown }, value: unknown) => {
  try {
    field.validate(value);
    return false;
  } catch {
    return true;
  }
};

describe('keystatic/fields: unknown values', () => {
  it('unknown(text) reads a stored null as empty, writes null back, and skips checks while empty', () => {
    const field = unknown(text('Phone', { pattern: /^\+/ }));
    const parsed = field.parse(STORED_NULL);
    expect(parsed).toBe('');
    expect(field.serialize(parsed)).toEqual({ value: null });
    expect(invalid(field, '')).toBe(false);
    expect(invalid(field, '254')).toBe(true);
    expect(field.serialize('+254')).toEqual({ value: '+254' });
    expect(field.reader.parse(STORED_NULL)).toBeNull();
    expect(field.reader.parse('+254')).toBe('+254');
  });

  it('unknown(date) and unknown(ref) write null for empty', () => {
    const when = unknown(date('As of'));
    expect(when.parse(STORED_NULL)).toBeNull();
    expect(when.serialize(null)).toEqual({ value: null });
    expect(when.parse(new Date('2026-09-26'))).toBe('2026-09-26');
    expect(when.reader.parse(STORED_NULL)).toBeNull();
    const author = unknown(ref('Author', 'authors'));
    expect(author.serialize(author.parse(STORED_NULL))).toEqual({ value: null });
    expect(author.serialize('subhashish-saha')).toEqual({ value: 'subhashish-saha' });
  });

  it('unknown() records the inner field for the parity test', () => {
    const field = unknown(text('City'));
    expect(FIELD_META.get(field)).toMatchObject({ kind: 'unknown', inner: { kind: 'text', required: false } });
  });

  it('unknownChoice maps null to Unknown and back', () => {
    const field = unknownChoice('State', ['live', 'planned']);
    expect(field.parse(STORED_NULL)).toBe('__unknown__');
    expect(field.serialize('__unknown__')).toEqual({ value: null });
    expect(field.serialize('live')).toEqual({ value: 'live' });
    expect(field.reader.parse(STORED_NULL)).toBeNull();
    expect(() => field.parse('__unknown__')).toThrow();
    expect(() => field.parse('retired')).toThrow();
  });

  it('unknownFlag maps null, true and false', () => {
    const field = unknownFlag('Consent on file');
    expect([STORED_NULL, true, false].map((v) => field.parse(v))).toEqual(['__unknown__', 'yes', 'no']);
    expect(['__unknown__', 'yes', 'no'].map((v) => field.serialize(v).value)).toEqual([null, true, false]);
    expect(field.reader.parse(true)).toBe(true);
    expect(field.reader.parse(STORED_NULL)).toBeNull();
    expect(() => field.parse('yes')).toThrow();
  });

  it('unknownList edits one item per line; empty means null', () => {
    const field = unknownList('Payment methods');
    expect(field.parse(STORED_NULL)).toBe('');
    expect(field.parse(['Card', 'Bank transfer'])).toBe('Card\nBank transfer');
    expect(field.serialize(' Card \n\nBank transfer\n').value).toEqual(['Card', 'Bank transfer']);
    expect(field.serialize('  \n').value).toBeNull();
    expect(field.reader.parse(STORED_NULL)).toBeNull();
    expect(() => field.parse([1])).toThrow();
  });

  it('preserved() leaves an absent key out; preserved({ nullable }) writes null back', () => {
    const extras = preserved();
    expect(extras.serialize(extras.parse(STORED_NULL))).toEqual({ value: undefined });
    expect(extras.serialize(extras.parse({ a: 1 }))).toEqual({ value: { a: 1 } });
    const source = preserved({ nullable: true });
    expect(source.serialize(source.parse(STORED_NULL))).toEqual({ value: null });
    const signed = { description: 'x', period: 'y', approvedBy: 'z' };
    expect(source.serialize(source.parse(signed))).toEqual({ value: signed });
    expect(source.reader.parse(STORED_NULL)).toBeNull();
  });
});

describe('keystatic/fields: choices and text', () => {
  it('a required choice starts on a sentinel that cannot be saved', () => {
    const field = choice('Kind', ['law', 'tax'], { required: true });
    expect(field.defaultValue()).toBe('__choose__');
    expect(invalid(field, '__choose__')).toBe(true);
    expect(invalid(field, 'law')).toBe(false);
    expect(() => field.reader.parse(undefined)).toThrow();
    expect(field.reader.parse('tax')).toBe('tax');
  });

  it('a choice with a Zod default starts on it', () => {
    const field = choice('Width', ['measure', 'wide'], { zodDefault: 'measure' });
    expect(field.defaultValue()).toBe('measure');
    expect(field.parse(undefined)).toBe('measure');
    expect(FIELD_META.get(field)).toMatchObject({ kind: 'choice', zodDefault: 'measure', options: ['measure', 'wide'] });
  });

  it('optionalChoice leaves the key out for Default', () => {
    const field = optionalChoice('Background', ['plain', 'wash']);
    expect(field.parse(undefined)).toBe('__default__');
    expect(field.serialize('__default__')).toEqual({ value: undefined });
    expect(field.serialize('wash')).toEqual({ value: 'wash' });
    expect(field.reader.parse(undefined)).toBeNull();
  });

  it('choices gives every new item its own array', () => {
    const field = choices('Personas', ['solo', 'chain']);
    expect(field.defaultValue()).not.toBe(field.defaultValue());
  });

  it('boolOrText maps yes and no to booleans and keeps other text', () => {
    const field = boolOrText('Premium');
    expect([true, false, 'own patients only'].map((v) => field.parse(v))).toEqual(['yes', 'no', 'own patients only']);
    expect(['yes', 'no', 'Add-on'].map((v) => field.serialize(v).value)).toEqual([true, false, 'Add-on']);
    expect(invalid(field, '')).toBe(true);
    expect(() => field.reader.parse(undefined)).toThrow();
  });

  it('an optional field with a pattern or a minimum length can be left empty', () => {
    const hub = path('Hub');
    expect(invalid(hub, '')).toBe(false);
    expect(invalid(hub, '/features/emr/')).toBe(false);
    expect(invalid(hub, '/Features')).toBe(true);
    const answer = text('What only we could write', { min: 10 });
    expect(invalid(answer, '')).toBe(false);
    expect(invalid(answer, 'too short')).toBe(true);
    expect(invalid(answer, 'long enough now')).toBe(false);
  });

  it('a required field refuses an empty value, so the key is never dropped on save', () => {
    const title = text('Title', { required: true, min: 10 });
    expect(invalid(title, '')).toBe(true);
    expect(invalid(title, 'A long enough title')).toBe(false);
    expect(invalid(path('Path', { required: true }), '')).toBe(true);
  });
});

describe('Zod side of the Keystatic contract', () => {
  it('unknown() rejects an empty string', () => {
    const schema = zUnknown(z.string());
    expect(schema.safeParse(null).success).toBe(true);
    expect(schema.safeParse('Nairobi').success).toBe(true);
    expect(schema.safeParse('').success).toBe(false);
  });

  it('isoDate accepts a date without a time only', () => {
    expect(isoDate.parse(new Date('2026-09-26'))).toEqual(new Date('2026-09-26'));
    expect(isoDate.parse('2026-09-26')).toEqual(new Date('2026-09-26'));
    expect(isoDate.safeParse(new Date('2026-09-26T10:30:00Z')).success).toBe(false);
    expect(isoDate.safeParse('2026-09-26T00:00:00Z').success).toBe(false);
    expect(isoDate.safeParse('2026-13-45').success).toBe(false);
    expect(isoDate.safeParse('26 September 2026').success).toBe(false);
  });

  it('optionalGroup treats a blank or defaults-only object as absent and still checks a filled one', () => {
    const schema = z.object({ secondary: optionalCta });
    expect(schema.parse({}).secondary).toBeUndefined();
    expect(schema.parse({ secondary: {} }).secondary).toBeUndefined();
    expect(schema.parse({ secondary: { label: '', event: '' } }).secondary).toBeUndefined();
    expect(schema.parse({ secondary: { label: 'See prices', href: '/pricing/' } }).secondary).toEqual({ label: 'See prices', href: '/pricing/' });
    expect(schema.safeParse({ secondary: { label: 'See prices' } }).success).toBe(false);
    const media = optionalGroup(z.object({ alt: z.string().min(1), kind: z.string().default('screenshot') }), ['alt']);
    expect(media.parse({ kind: 'screenshot' })).toBeUndefined();
    expect(cta.safeParse({}).success).toBe(false);
  });

  it('blankGroupsToUndefined drops blank groups wherever they sit in raw data', () => {
    const raw = {
      editorialPass: {},
      claimsReview: { by: 'Editor', on: '2026-09-26' },
      ctas: { primary: { label: 'Book', href: '/demo/' }, secondary: { label: '' } },
      sections: [{ discriminant: 'featureRows', value: { items: [{ media: { kind: 'screenshot', frame: 'browser', aiGenerated: false } }] } }],
      regulatorLink: { link: '/trust/' },
    };
    const out = blankGroupsToUndefined(raw);
    expect('editorialPass' in out).toBe(false);
    expect(out.claimsReview).toEqual(raw.claimsReview);
    expect(out.ctas).toEqual({ primary: raw.ctas.primary });
    expect(out.sections[0].value.items[0]).toEqual({});
    expect(out.regulatorLink).toEqual({ link: '/trust/' });
    expect(hasValue({ primary: { label: '' } })).toBe(false);
    expect(CTA_PRESENT_IF).toEqual(['label', 'href', 'event']);
  });
});
