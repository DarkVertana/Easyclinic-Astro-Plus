declare namespace App {
  interface Locals {
    /** Set by src/pages/[...path].astro for content-backed pages. */
    page?: {
      path: string;
      status: 'draft' | 'review' | 'published';
      family: string;
      country?: string;
      title: string;
    };
  }
}
