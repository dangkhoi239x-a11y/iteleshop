import { z } from "zod";

/** Mirrors SQL daily_checkin: 10 points per day, +40 bonus on every 7th consecutive day. */
export const checkinPoints = (streak: number) => 10 + (streak > 0 && streak % 7 === 0 ? 40 : 0);

export const TASK_KINDS = ["join_channel", "invite", "first_purchase", "spend", "custom"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

/** Whether a verifiable task's requirement is met given the measured progress. */
export function taskMet(kind: TaskKind, progress: number, target: number) {
  if (kind === "custom") return true;
  if (kind === "join_channel") return progress >= 1;
  if (kind === "first_purchase") return progress >= 1;
  return progress >= Math.max(1, target);
}

export const pointsBalance = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0);

export const taskSchema = z.object({
  shopId: z.string().uuid().nullable(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  kind: z.enum(TASK_KINDS),
  target: z.string().trim().max(120).optional(),
  targetAmount: z.number().min(0).max(1_000_000).default(0),
  linkUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  points: z.number().int().min(1).max(100000),
}).refine((v) => v.kind !== "join_channel" || /^@[A-Za-z0-9_]{4,}$|^-?\d+$/.test(v.target ?? ""), { message: "Channel must be @username or chat ID", path: ["target"] });

export const drawSchema = z.object({
  shopId: z.string().uuid().nullable(),
  title: z.string().trim().min(2).max(120),
  prize: z.string().trim().min(1).max(500),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  entryCost: z.number().int().min(0).max(1_000_000),
  maxEntries: z.number().int().min(1).max(1000),
  winners: z.number().int().min(1).max(1000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
}).refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: "End must be after start", path: ["endsAt"] });
