/** Page context every block receives alongside its own section value. */
export interface BlockContext {
  path: string;
  family: string;
  status: 'draft' | 'review' | 'published';
  /** Country id of the page (in, ke, ae, ng), when it has one. */
  country?: string;
  pageLabel: string;
  /** Click-to-chat link routed to the page's country contact, prefilled with the page name. */
  whatsappHref: string;
  /** Position in the page, used to alternate backgrounds when a block sets no tone. */
  index: number;
}

export type Tone = 'plain' | 'wash' | 'inverse';

/** Sections alternate white and a light wash (section 11) unless the content sets a tone. */
export function toneFor(tone: Tone | undefined, index: number): Tone {
  return tone ?? (index % 2 === 0 ? 'plain' : 'wash');
}
