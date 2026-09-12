import { z } from "zod";

export const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  skills: z.array(z.string()),
  yearsOfExperience: z.number().nonnegative(),
  location: z.string(),
  expectedSalary: z.number().nonnegative(),
});

export const createCandidateSchema = candidateSchema.omit({ id: true });
