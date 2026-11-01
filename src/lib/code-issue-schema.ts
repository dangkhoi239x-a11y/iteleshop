import { z } from "zod";
export const reportCodeSchema = z.object({ orderId: z.string().uuid(), codeId: z.string().uuid(), description: z.string().trim().min(10).max(2000) });
export const resolveCodeSchema = z.object({ issueId: z.string().uuid(), action: z.enum(["reviewing", "replaced", "rejected"]), note: z.string().trim().min(2).max(2000) });