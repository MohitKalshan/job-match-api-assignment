import { z } from "zod";

export const recommendationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
  weightSkills: z.coerce.number().nonnegative().optional(),
  weightExperience: z.coerce.number().nonnegative().optional(),
  weightLocation: z.coerce.number().nonnegative().optional(),
  weightSalary: z.coerce.number().nonnegative().optional(),
});
