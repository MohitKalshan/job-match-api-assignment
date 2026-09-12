import type { Candidate, CreateCandidate } from "./candidate.js";
import type { CreateJob, Job } from "./job.js";

// Storage contracts. The composition root picks the implementation; nothing else
// imports a concrete store, so tests can substitute their own.
export interface CandidateStore {
  create(data: CreateCandidate): Candidate;
  getById(id: string): Candidate | undefined;
  list(): Candidate[];
}

export interface JobStore {
  create(data: CreateJob): Job;
  getById(id: string): Job | undefined;
  list(): Job[];
}
