import type { ImageMetadata } from 'astro';
import type { PostTopic } from '../../../schemas/constants';

/**
 * Cover images for the /blog/ cards. A guide's own photo is `src/assets/images/blog/<slug>.<ext>`, named after the
 * last segment of its path (the featured images taken from the live easyclinic.io posts, 2026-10-28). A guide
 * without one gets an Easy Clinic product screenshot from its topic, so every card has a real cover.
 */
const photos = import.meta.glob<{ default: ImageMetadata }>('/src/assets/images/blog/*.{jpg,jpeg,png,webp}', { eager: true });
const photoBySlug = new Map(Object.entries(photos).map(([file, mod]) => [file.split('/').pop()!.replace(/\.\w+$/, ''), mod.default]));

const shots = import.meta.glob<{ default: ImageMetadata }>('/src/assets/images/{tabs,solutions,products,resources,curapilot,pricing}/*.{jpg,png,webp}', {
  eager: true,
});
const shot = (file: string) => {
  const image = shots[`/src/assets/images/${file}`]?.default;
  if (!image) throw new Error(`Blog cover screenshot not found: src/assets/images/${file}`);
  return image;
};

/** Product screenshots per topic; neighbouring cards in a topic take turns through the list. */
const TOPIC_SHOTS: Record<PostTopic, ImageMetadata[]> = {
  'start-a-clinic': [shot('tabs/Clinic-Management.png'), shot('products/14_Dashboard.jpg'), shot('solutions/16_Portal.png')],
  'switching-to-emr': [shot('tabs/1_EMR-1.png'), shot('solutions/2_EMR.png'), shot('resources/Prescription-4-3.png'), shot('solutions/Examination-3-1.png')],
  'running-a-chain': [shot('products/19_Multi_location.png'), shot('products/1-6.png'), shot('products/Multilocation-telecom.png')],
  'compliance-by-country': [shot('solutions/18_Security.png'), shot('resources/18_User.png'), shot('products/17_Integration.png')],
  'cura-ai': [shot('curapilot/AI-suggestions-1.png'), shot('curapilot/usecase1.webp'), shot('curapilot/curapilt-integartion.png')],
  'billing-and-claims': [shot('solutions/Invoice_Feature_01.png'), shot('products/Payor-11.png'), shot('pricing/Payor-7.png')],
  'patient-engagement': [shot('products/3_Video_consultent.png'), shot('solutions/16_Portal.png'), shot('products/Multilocation-telecom.png')],
  'running-a-clinic': [shot('products/11_Pharmacy_2.png'), shot('products/9_01_Inventory.png'), shot('solutions/14_Dashboard (1).jpg'), shot('resources/15_Workflow.png')],
};

export interface Cover {
  src: ImageMetadata;
  /** A photo fills the frame; a screenshot sits inset on the brand wash. */
  kind: 'photo' | 'screenshot';
}

const slugOf = (path: string) => path.replace(/\/$/, '').split('/').pop() ?? '';
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** `index` is the card's place among its neighbours, so screenshots alternate; without it the slug picks one. */
export function coverFor(item: { path: string; topic: PostTopic }, index?: number): Cover {
  const photo = photoBySlug.get(slugOf(item.path));
  if (photo) return { src: photo, kind: 'photo' };
  const pool = TOPIC_SHOTS[item.topic];
  return { src: pool[(index ?? hash(item.path)) % pool.length], kind: 'screenshot' };
}
