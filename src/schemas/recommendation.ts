import { z } from "zod";

export const recommendationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});
