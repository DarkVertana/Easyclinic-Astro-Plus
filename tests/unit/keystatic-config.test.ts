/**
 * Keystatic foundation checks (docs/keystatic-design.md sections 1, 2.7 and 7): the Keystatic collections cover
 * the Astro collections at the same paths, every page family offers exactly its allowed blocks, the fixed key
 * lists match the data files, and Keystatic's reader opens every existing entry. The field-by-field parity and the
 * save round trip are separate tests (keystatic-parity, keystatic-roundtrip) that land with the block forms.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createReader } from '@keystatic/core/reader';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import keystaticConfig from '../../keystatic.config.ts';
import { KS_BLOCKS } from '../../keystatic/blocks/index.ts';
import { ADDON_IDS } from '../../keystatic/collections/data.ts';
import { FACT_KEYS, SOCIAL_KEYS } from '../../keystatic/collections/singletons.ts';
import {
  CLIENT_LOGO_DIR,
  DATA_CLIENT_LOGO_PATH,
  DATA_PEOPLE_PATH,
  FIELD_META,
  MDX_SCREENSHOT_PATH,
  PEOPLE_DIR,
  SCREENSHOT_DIR,
  YAML_SCREENSHOT_PATH,
} from '../../keystatic/fields.ts';
import { BLOCK_NAMES, FAMILY_BLOCKS, type PageFamily } from '../../src/schemas/family-blocks.ts';
import { describeError as describeReaderError, pendingFixesFor } from './keystatic-harness.ts';

const ROOT = process.cwd();
const collections = keystaticConfig.collections as Record<string, { path: string; schema: Record<string, object>; format?: unknown }>;
const singletons = keystaticConfig.singletons as Record<string, { path: string }>;
const contentConfig = readFileSync(join(ROOT, 'src/content.config.ts'), 'utf8');

/** Page collection → family, as src/content.config.ts assigns the schemas. */
const FAMILY_OF: Record<string, PageFamily> = {
  home: 'home',
  pricing: 'pricing',
  countryPages: 'country',
  countryDemos: 'countryDemo',
  company: 'company',
  kitchenSink: 'kitchenSink',
  hubs: 'hub',
  features: 'feature',
  solutions: 'solution',
  ai: 'ai',
  curapilot: 'curapilot',
  trust: 'trust',
  specialties: 'specialty',
  guides: 'guide',
  posts: 'post',
  comparisons: 'comparison',
  listicles: 'listicle',
  alternatives: 'listicle',
  customers: 'customers',
  legal: 'legal',
  glossary: 'glossary',
};
/** Blocks whose Zod schema has a media field (a relative image path that only works one folder deep). */
const MEDIA_BLOCKS = ['featureRows', 'journeyDiagram', 'moduleGrid', 'oldWayNewWay', 'proofBlock'];

function walkFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walkFiles(p) : [p];
  });
}

/** Entry ids as Astro's glob loaders in src/content.config.ts produce them, from the folder the Keystatic path names. */
function astroIds(ksPath: string): string[] {
  const dir = join(ROOT, ksPath.replace(/\/\*\*?\/?$/, ''));
  if (ksPath.endsWith('/*/')) {
    return readdirSync(dir).filter((name) => {
      try {
        return statSync(join(dir, name, 'index.mdx')).isFile();
      } catch {
        return false;
      }
    });
  }
  const ext = ksPath.endsWith('/**') ? '.mdx' : '.yaml';
  return walkFiles(dir)
    .filter((file) => file.endsWith(ext))
    .map((file) => relative(dir, file).slice(0, -ext.length));
}

describe('Keystatic collections match the Astro collections', () => {
  it('every Astro collection except the routing lists has a Keystatic collection or singleton with the same key', () => {
    const block = contentConfig.slice(contentConfig.indexOf('export const collections = {'));
    const astroKeys = [...block.slice(block.indexOf('{') + 1, block.indexOf('}')).matchAll(/(\w+),/g)].map((m) => m[1]);
    const ksKeys = [...Object.keys(collections), ...Object.keys(singletons)];
    expect(astroKeys.filter((key) => !['redirects', 'gone'].includes(key)).sort()).toEqual([...ksKeys].sort());
  });

  it('page collections use the folders src/content.config.ts loads', () => {
    for (const [key, family] of Object.entries(FAMILY_OF)) {
      const dir = contentConfig.match(new RegExp(`const ${key} = defineCollection\\(\\{ loader: pages\\('([^']+)'\\)`))?.[1];
      const expected = dir ? `src/content/${dir}/*` : { guides: 'src/content/guides/*/', posts: 'src/content/posts/*/', legal: 'src/content/legal/**' }[key];
      expect(collections[key]?.path, `${key} (${family})`).toBe(expected);
    }
  });

  it('data collections and singletons use the files src/content.config.ts loads', () => {
    for (const key of ['prices', 'countries', 'regulators', 'testimonials', 'authors', 'clients', 'integrations']) {
      expect(contentConfig).toContain(`const ${key} = defineCollection({ loader: data('*.yaml', '${key}')`);
      expect(collections[key].path).toBe(`src/data/${key}/*`);
    }
    for (const key of ['site', 'facts', 'study', 'plans', 'nav']) {
      expect(contentConfig).toContain(`const ${key} = defineCollection({ loader: data('${key}.yaml')`);
      expect(singletons[key].path).toBe(`src/data/${key}`);
    }
  });
});

describe('sections', () => {
  it('KS_BLOCKS has every block, in registry order', () => {
    expect(Object.keys(KS_BLOCKS)).toEqual([...BLOCK_NAMES]);
  });

  it('each page collection offers exactly its family’s blocks', () => {
    for (const [key, family] of Object.entries(FAMILY_OF)) {
      const meta = FIELD_META.get(collections[key].schema.sections);
      expect(meta, key).toEqual({ kind: 'sections', blocks: FAMILY_BLOCKS[family] });
    }
  });

  it('no block with media is allowed in an MDX family', () => {
    for (const family of ['guide', 'post', 'legal'] as const) {
      expect(FAMILY_BLOCKS[family].filter((name) => MEDIA_BLOCKS.includes(name)), family).toEqual([]);
    }
  });

  it('only keystatic/fields.ts builds Keystatic fields', () => {
    const offenders = walkFiles(join(ROOT, 'keystatic'))
      .filter((file) => !file.endsWith('/keystatic/fields.ts'))
      .filter((file) => /import\s*\{[^}]*\bfields\b[^}]*\}\s*from\s*'@keystatic\/core'/.test(readFileSync(file, 'utf8')));
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });

  // Blocks still on todoBlock(): their stored values pass through untouched, with no form yet.
  for (const [name, block] of Object.entries(KS_BLOCKS)) {
    if (FIELD_META.get(block.schema)?.kind === 'stub') it.todo(`Keystatic form for the ${name} block`);
  }
});

describe('fixed key lists match the data files', () => {
  const yaml = (file: string) => parse(readFileSync(join(ROOT, file), 'utf8'));

  it('facts, in file order', () => {
    expect([...FACT_KEYS]).toEqual(Object.keys(yaml('src/data/facts.yaml').facts));
  });
  it('social profiles, in footer order', () => {
    expect([...SOCIAL_KEYS]).toEqual(Object.keys(yaml('src/data/site.yaml').social));
  });
  it('add-on ids, in plans.yaml and every price file', () => {
    expect([...ADDON_IDS]).toEqual(yaml('src/data/plans.yaml').addons.map((a: { id: string }) => a.id));
    for (const file of readdirSync(join(ROOT, 'src/data/prices'))) {
      expect(Object.keys(yaml(`src/data/prices/${file}`).addons ?? {}), file).toEqual([...ADDON_IDS]);
    }
  });
});

describe('Keystatic reads every existing entry', () => {
  const reader = createReader(ROOT, keystaticConfig) as unknown as {
    collections: Record<string, { list(): Promise<string[]>; readOrThrow(slug: string): Promise<unknown> }>;
    singletons: Record<string, { readOrThrow(): Promise<unknown> }>;
  };
  const describeError = (error: unknown): string => {
    if (error instanceof AggregateError) return error.errors.map(describeError).join('; ');
    const e = error as { message?: string; path?: unknown[]; cause?: unknown };
    return [e.path?.join('.'), e.message, e.cause ? describeError(e.cause) : ''].filter(Boolean).join(': ');
  };

  for (const key of Object.keys(collections)) {
    it(`collection ${key}`, async () => {
      const slugs = await reader.collections[key].list();
      expect([...slugs].sort()).toEqual(astroIds(collections[key].path).sort());
      const failures: string[] = [];
      for (const slug of slugs) {
        try {
          await reader.collections[key].readOrThrow(slug);
        } catch (error) {
          // Known data problems waiting for a src/content edit are left to keystatic-roundtrip, which expects them exactly.
          const pending = pendingFixesFor(key, slug).map((fix) => fix.issue);
          const issues = describeReaderError(error).filter((line) => !/^Invalid data for /.test(line) && !pending.includes(line));
          if (issues.length) failures.push(`${slug}: ${issues.join('; ')}`);
        }
      }
      expect(failures).toEqual([]);
    });
  }

  for (const key of Object.keys(singletons)) {
    it(`singleton ${key}`, async () => {
      await expect(reader.singletons[key].readOrThrow()).resolves.toBeTruthy();
    });
  }
});

/**
 * Photos and logos in src/data (docs/image-plan.md 3.2 and 4). Keystatic stores and looks up an image at
 * `<directory>/<entry id>/<file>` and renames it to the field's name on save, so a file placed anywhere else opens as
 * empty in the editor and the next save drops the key (docs/keystatic-design.md, media).
 */
describe('photos and logos in src/data use Keystatic’s layout', () => {
  type ImageField = {
    directory?: string;
    filename(value: unknown, args: { slug: string }): string | undefined;
    parse(value: unknown, args: { asset: Uint8Array | undefined; slug: string }): unknown;
    serialize(value: unknown, args: { suggestedFilenamePrefix?: string; slug: string }): { value: unknown };
  };
  const FIELDS = [
    { key: 'testimonials', field: 'photo', dir: PEOPLE_DIR, prefix: DATA_PEOPLE_PATH },
    { key: 'authors', field: 'photo', dir: PEOPLE_DIR, prefix: DATA_PEOPLE_PATH },
    { key: 'clients', field: 'logo', dir: CLIENT_LOGO_DIR, prefix: DATA_CLIENT_LOGO_PATH },
  ] as const;
  const imageField = (key: string, field: string) => collections[key].schema[field] as unknown as ImageField;
  const ids = (key: string) => readdirSync(join(ROOT, `src/data/${key}`)).filter((f) => f.endsWith('.yaml')).map((f) => f.slice(0, -5));

  for (const { key, field, dir, prefix } of FIELDS) {
    it(`${key}.${field}: a file at ${dir}/<id>/${field}.<ext> opens and saves unchanged; a flat file does not`, () => {
      const image = imageField(key, field);
      expect(image.directory).toBe(dir);
      const value = `${prefix}sample-id/${field}.jpg`;
      expect(image.filename(value, { slug: 'sample-id' })).toBe(`${field}.jpg`);
      const state = image.parse(value, { asset: new Uint8Array([1]), slug: 'sample-id' });
      expect(image.serialize(state, { suggestedFilenamePrefix: field, slug: 'sample-id' }).value).toBe(value);
      // The flat layout (`<dir>/<id>.jpg`) is looked up somewhere else, so the editor opens it as empty.
      expect(image.filename(`${prefix}sample-id.jpg`, { slug: 'sample-id' })).not.toBe('sample-id.jpg');
    });

    it(`every ${key} ${field} in src/data sits at ${dir}/<id>/${field}.<ext> and the file exists`, () => {
      const wrong: string[] = [];
      for (const id of ids(key)) {
        const value = parse(readFileSync(join(ROOT, `src/data/${key}/${id}.yaml`), 'utf8'))?.[field];
        if (value === undefined || value === null) continue;
        const ext = /\.([a-z0-9]+)$/.exec(String(value))?.[1];
        const expected = `${prefix}${id}/${field}.${ext}`;
        if (value !== expected) wrong.push(`${key}/${id}: ${field} is ${value}; use ${expected}`);
        else if (!existsSync(join(ROOT, dir, id, `${field}.${ext}`))) wrong.push(`${key}/${id}: no file at ${dir}/${id}/${field}.${ext}`);
      }
      expect(wrong).toEqual([]);
    });
  }

  it('media src: a path into the shared screenshot library saves unchanged; any other path is refused', () => {
    type Text = { parse(v: unknown, x: undefined): string; validate(v: string, x: undefined): string; serialize(v: string, x: undefined): { value: unknown } };
    type Node = { fields: Record<string, Node>; element: Node } & Text;
    const blockSrc = (KS_BLOCKS.featureRows.schema as unknown as Node).fields.items.element.fields.media.fields.src;
    const guideSrc = (collections.guides.schema.heroMedia as unknown as Node).fields.src;
    const saves = (field: Text, value: string) => {
      try {
        return field.serialize(field.validate(field.parse(value, undefined), undefined), undefined).value;
      } catch {
        return 'refused';
      }
    };
    for (const [field, prefix] of [[blockSrc, YAML_SCREENSHOT_PATH], [guideSrc, MDX_SCREENSHOT_PATH]] as const) {
      expect(FIELD_META.get(field)).toMatchObject({ kind: 'imagePath', directory: SCREENSHOT_DIR, publicPath: prefix });
      expect(saves(field, `${prefix}prescription-drug-interaction.png`)).toBe(`${prefix}prescription-drug-interaction.png`);
      expect(saves(field, `${prefix}cura-ai-consult-transcription.webp`)).toBe(`${prefix}cura-ai-consult-transcription.webp`);
      expect(saves(field, '')).toBeUndefined();
      for (const wrong of [`${prefix}Screen 1.png`, `${prefix}sub/x.png`, `${prefix}x.gif`, '../../assets/screenshots/emr/x.png', '/images/x.png']) {
        expect(saves(field, wrong), wrong).toBe('refused');
      }
    }
  });

  it('testimonial and author ids do not clash (their photos share src/assets/images/people/<id>/)', () => {
    const authors = new Set(ids('authors'));
    expect(ids('testimonials').filter((id) => authors.has(id))).toEqual([]);
  });
});
