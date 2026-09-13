import type { Candidate, CreateCandidate } from "./candidate.js";
import type { CreateJob, Job } from "./job.js";

// Storage contracts. Async so any backend fits — in-memory, Postgres, or a future MongoDB
// store. The composition root picks the implementation; nothing else imports a concrete
// store, so routes never change when the database does.
export interface CandidateStore {
  create(data: CreateCandidate): Promise<Candidate>;
  getById(id: string): Promise<Candidate | undefined>;
  list(): Promise<Candidate[]>;
}

export interface JobStore {
  create(data: CreateJob): Promise<Job>;
  getById(id: string): Promise<Job | undefined>;
  list(): Promise<Job[]>;
}
