import { z } from "zod";

export const recommendationQuerySchema = z.object({
  // Default and hard cap: an uncapped list endpoint dumps the whole store.
  limit: z.coerce.number().int().positive().max(100).default(20),
  weightSkills: z.coerce.number().nonnegative().optional(),
  weightExperience: z.coerce.number().nonnegative().optional(),
  weightLocation: z.coerce.number().nonnegative().optional(),
  weightSalary: z.coerce.number().nonnegative().optional(),
});
