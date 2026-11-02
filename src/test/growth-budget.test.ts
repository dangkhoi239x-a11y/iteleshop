import { describe, expect, it } from 'vitest';
import { forecastBudget } from '@/lib/growth-budget';
const d = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 864e5).toISOString();
describe('growth budget forecast', () => {
  it('projects pace and depletion date', () => {
    const f = forecastBudget({ budgetTon: 10, delivered: 20, remaining: 80, startsAt: d(0), endsAt: d(10), now: Date.parse(d(2)) });
    expect(f.perDay).toBe(10); expect(f.projected).toBe(100); expect(f.depletesAt).toBeNull();
    expect(f.usedTon).toBeCloseTo(2); expect(f.remainingTon).toBeCloseTo(8);
  });
  it('reports leftover when pace is slow', () => {
    const f = forecastBudget({ budgetTon: 0, delivered: 1, remaining: 99, startsAt: d(0), endsAt: d(10), now: Date.parse(d(5)) });
    expect(f.projected).toBe(2); expect(f.leftover).toBe(98); expect(f.depletesAt).toBeNull();
  });
});
