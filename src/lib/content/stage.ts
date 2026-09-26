/**
 * Build stage. Production renders published entries only; preview (every non-production deploy,
 * and local dev) renders everything with placeholders highlighted and noindex set.
 */
export type Stage = 'production' | 'preview';

export const STAGE: Stage =
  process.env.CONTENT_STAGE === 'production' || (!process.env.CONTENT_STAGE && process.env.VERCEL_ENV === 'production')
    ? 'production'
    : 'preview';

export const isProduction = STAGE === 'production';

/** Launch switch (plan, Phase 4). Until set, every host gets noindex, including www. */
export const INDEXING_ENABLED = process.env.INDEXING_ENABLED === 'true';
