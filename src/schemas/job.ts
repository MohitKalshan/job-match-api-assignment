import { z } from "zod";
import { SkillPriority } from "../enums/skill-priority.js";

export const requiredSkillSchema = z.object({
  skill: z.string(),
  priority: z.enum(SkillPriority),
});

export const salaryRangeSchema = z
  .object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  })
  .refine((range) => range.min <= range.max, {
    message: "min must be less than or equal to max",
    path: ["min"],
  });

export const jobSchema = z.object({
  id: z.string(),
  title: z.string(),
  requiredSkills: z.array(requiredSkillSchema),
  minYearsExperience: z.number().nonnegative(),
  location: z.string(),
  salaryRange: salaryRangeSchema,
  remoteAllowed: z.boolean(),
});

export const createJobSchema = jobSchema.omit({ id: true });
