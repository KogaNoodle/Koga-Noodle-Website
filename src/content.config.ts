import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { linkedinSchema } from './content/linkedin/schema';

const linkedin = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/linkedin' }),
  schema: linkedinSchema,
});

export const collections = { linkedin };
