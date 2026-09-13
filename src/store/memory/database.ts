import type { Candidate } from "../types/candidate.js";
import type { Job } from "../types/job.js";

// Singleton in-memory database: the private constructor means the only way to get one is
// getInstance(), which always returns the same instance for the life of the process.
export class Database {
  private static instance: Database | undefined;

  readonly candidates = new Map<string, Candidate>();
  readonly jobs = new Map<string, Job>();

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
}
