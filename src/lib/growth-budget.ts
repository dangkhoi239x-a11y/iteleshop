export type BudgetInput = { budgetTon: number; delivered: number; remaining: number; startsAt: string; endsAt: string; now?: number };
/** Forecast prize depletion from the delivery pace since the campaign started. */
export function forecastBudget(i: BudgetInput) {
  const now = i.now ?? Date.now(), start = Date.parse(i.startsAt), end = Date.parse(i.endsAt);
  const total = i.delivered + i.remaining;
  const elapsedDays = Math.max(0, (Math.min(now, end) - start) / 864e5);
  const daysLeft = Math.max(0, (end - now) / 864e5);
  const perDay = elapsedDays >= 1 / 24 ? i.delivered / elapsedDays : 0;
  const projected = Math.min(total, i.delivered + Math.round(perDay * daysLeft));
  const depletesAt = perDay > 0 && i.remaining > 0 && i.remaining / perDay < daysLeft ? new Date(now + (i.remaining / perDay) * 864e5).toISOString() : null;
  const tonPerPrize = total > 0 ? i.budgetTon / total : 0;
  return { total, perDay, projected, leftover: total - projected, depletesAt, usedTon: tonPerPrize * i.delivered, remainingTon: Math.max(0, i.budgetTon - tonPerPrize * i.delivered), projectedTon: tonPerPrize * projected };
}
