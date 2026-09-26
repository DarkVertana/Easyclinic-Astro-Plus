import { defineAction } from 'astro:actions';
import { z } from 'astro/zod';

export const server = {
  requestDemo: defineAction({
    accept: 'form',
    input: z.object({ name: z.string().min(1) }),
    handler: async (input) => ({ ok: true, name: input.name }),
  }),
};
