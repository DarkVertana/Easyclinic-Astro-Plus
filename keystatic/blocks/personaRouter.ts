import { PERSONAS, type Persona } from '../../src/schemas/constants.ts';
import { choice, defineBlock, group, list, path, text } from '../fields.ts';

/** Persona ladder labels (spec 2.8) for the select; the stored values stay the ids in PERSONAS. Also used by clinicTypes. */
export const PERSONA_LABELS: Readonly<Record<Persona, string>> = {
  solo: 'Solo doctor',
  polyclinic: 'Polyclinic',
  chain: 'Clinic group (chain)',
  'hospital-opd': 'Hospital or OPD',
  ngo: 'NGO clinic',
};

/**
 * `personaRouter` section (Zod: src/components/blocks/PersonaRouter/schema.ts): "Pick your clinic" (spec 5.1 item 2),
 * one tile per rung of the persona ladder. Each tile is one link, on its title.
 */
export const personaRouter = defineBlock('personaRouter', 'Persona router', {
  items: list(
    group('Tile', {
      persona: choice('Persona', PERSONAS, { required: true }, { labels: PERSONA_LABELS, description: 'Which rung of the clinic ladder this tile is for. Sets the default icon.' }),
      title: text('Title', { required: true, description: 'In the reader’s words, e.g. "I run my own clinic". The title is the link.' }),
      body: text('Body', { required: true, description: 'One short line of plain text (no Markdown).' }),
      href: path('Link', { required: true, description: 'The page for this clinic type, e.g. /solutions/solo-clinic/. A page not live yet leaves the tile as plain text.' }),
      icon: text('Icon', { description: 'Lucide icon name from src/components/ui/icons.ts, e.g. user-round. Empty: the persona’s icon.' }),
    }),
    { label: 'Tiles', min: 2, max: 6, itemLabel: (props) => props.fields.title.value || 'Tile' },
  ),
});
