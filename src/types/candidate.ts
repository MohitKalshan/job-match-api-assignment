import type { z } from "zod";
import type { candidateSchema, createCandidateSchema } from "../schemas/candidate.js";

export type Candidate = z.infer<typeof candidateSchema>;
export type CreateCandidate = z.infer<typeof createCandidateSchema>;
