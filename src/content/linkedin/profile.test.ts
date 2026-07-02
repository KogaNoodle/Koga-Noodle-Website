import { describe, it, expect } from 'vitest';
import { linkedinSchema } from './schema';
import profile from './profile.json';

describe('linkedin schema', () => {
  it('validates the stub profile', () => {
    const result = linkedinSchema.safeParse(profile);
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format in positions', () => {
    const bad = {
      ...profile,
      positions: [{ ...profile.positions[0], startDate: 'March 2022' }],
    };
    expect(linkedinSchema.safeParse(bad).success).toBe(false);
  });

  it('requires headline and positions', () => {
    expect(linkedinSchema.safeParse({}).success).toBe(false);
  });

  it('defaults endorsements to 0 when omitted', () => {
    const minimal = {
      headline: 'Test',
      positions: [
        { title: 'T', company: 'C', startDate: '2020-01', isCurrent: true },
      ],
      skills: [{ name: 'Test' }],
    };
    const result = linkedinSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skills[0].endorsements).toBe(0);
    }
  });
});
