import { defineBlock, md, stringList, text } from '../fields.ts';

/**
 * `studyCard` section (Zod: src/components/blocks/StudyCard/schema.ts): method, sample, sites, publication link and
 * date for one publication in src/data/study.yaml (spec 5.3). `publication` and `figures` are ids inside the study
 * singleton, not entries of a collection, so they are plain text; the build fails on an id that study.yaml lacks, or
 * on a figure from another publication.
 */
export const studyCard = defineBlock('studyCard', 'Study card', {
  publication: text('Publication id', {
    required: true,
    description: 'The id of a publication in Study (src/data/study.yaml), e.g. korom-2025.',
  }),
  figures: stringList('Figures', 'Figure id', {
    description: 'Ids of figures in Study that come from this publication, in display order, e.g. visits.',
  }),
  method: md('Method', { required: true, description: 'Who ran the study and how it measured.' }),
  sites: md('Sites', { required: true, description: 'Where it ran and on what.' }),
  limits: md('Limits', { description: 'What the study did not measure.' }),
});
