import type { Candidate } from "../../types/candidate.js";
import type { Job } from "../../types/job.js";

// Singleton in-memory database: the private constructor means the only way to get one is
// getInstance(), which always returns the same instance for the life of the process.
export class MemoryDatabase {
  private static instance: MemoryDatabase | undefined;

  readonly candidates = new Map<string, Candidate>();
  readonly jobs = new Map<string, Job>();

  private constructor() {}

  static getInstance(): MemoryDatabase {
    if (!MemoryDatabase.instance) {
      MemoryDatabase.instance = new MemoryDatabase();
    }
    return MemoryDatabase.instance;
  }
}
