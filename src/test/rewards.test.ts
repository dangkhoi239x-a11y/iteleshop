import { describe, expect, it } from "vitest";
import { checkinPoints, drawSchema, pointsBalance, taskMet } from "@/lib/rewards";

describe("rewards rules", () => {
  it("check-in gives 10 points, 50 on every 7th streak day", () => {
    expect(checkinPoints(1)).toBe(10);
    expect(checkinPoints(7)).toBe(50);
    expect(checkinPoints(14)).toBe(50);
  });
  it("invite/spend tasks require reaching the target", () => {
    expect(taskMet("invite", 2, 3)).toBe(false);
    expect(taskMet("invite", 3, 3)).toBe(true);
    expect(taskMet("spend", 99.9, 100)).toBe(false);
  });
  it("first purchase needs one paid order", () => {
    expect(taskMet("first_purchase", 0, 0)).toBe(false);
    expect(taskMet("first_purchase", 1, 0)).toBe(true);
  });
  it("balance sums signed entries", () => expect(pointsBalance([{ amount: 50 }, { amount: -20 }])).toBe(30));
  it("draw end must be after start", () => {
    const base = { shopId: null, title: "Draw", prize: "Gift", entryCost: 0, maxEntries: 1, winners: 1 };
    expect(drawSchema.safeParse({ ...base, startsAt: "2026-11-02T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }).success).toBe(false);
    expect(drawSchema.safeParse({ ...base, startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-02T00:00:00Z" }).success).toBe(true);
  });
});
