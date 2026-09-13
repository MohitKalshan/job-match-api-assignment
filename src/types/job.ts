import type { z } from "zod";
import type {
  requiredSkillSchema,
  salaryRangeSchema,
  jobSchema,
  createJobSchema,
} from "../schemas/job.js";

export type RequiredSkill = z.infer<typeof requiredSkillSchema>;
export type SalaryRange = z.infer<typeof salaryRangeSchema>;
export type Job = z.infer<typeof jobSchema>;
export type CreateJob = z.infer<typeof createJobSchema>;
