import type { PostTopic } from '../../../schemas/constants';

/** One icon per blog topic (names from ui/icons.ts), shared by the /blog/ cards, topic tiles and the hero lead card. */
export const TOPIC_ICONS: Record<PostTopic, string> = {
  'switching-to-emr': 'repeat',
  'running-a-chain': 'network',
  'compliance-by-country': 'shield-check',
  'cura-ai': 'brain-circuit',
  'billing-and-claims': 'receipt',
  'patient-engagement': 'message-circle-heart',
  'start-a-clinic': 'building-2',
  'running-a-clinic': 'stethoscope',
};
