import { z } from 'zod';

/**
 * LinkedIn profile schema.
 * Kept in a standalone module (decoupled from astro:content) so it can be
 * unit-tested with plain vitest. Reused by the content collection config.
 *
 * Date format: ISO "YYYY-MM" (month precision), matching LinkedIn's API.
 */
export const linkedinSchema = z.object({
  headline: z.string(),
  summary: z.string().optional(),
  positions: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().optional(),
      startDate: z.string().regex(/^\d{4}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}$/).optional(),
      isCurrent: z.boolean(),
      description: z.string().optional(),
      skills: z.array(z.string()).optional(),
    })
  ),
  skills: z.array(
    z.object({
      name: z.string(),
      category: z.enum(['Frontend', 'Backend', 'Creative', 'Other']).optional(),
      endorsements: z.number().default(0),
    })
  ),
  education: z
    .array(
      z.object({
        school: z.string(),
        degree: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
    )
    .optional(),
});

export type LinkedinProfile = z.infer<typeof linkedinSchema>;
