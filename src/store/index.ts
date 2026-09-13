import type { DatabaseConfig } from "../config/env.js";
import type { CandidateStore, JobStore } from "../types/store.js";
import { PostgresDatabase } from "./postgres/database.js";
import { createPostgresCandidateStore } from "./postgres/candidates.js";
import { createPostgresJobStore } from "./postgres/jobs.js";

export interface Stores {
  candidateStore: CandidateStore;
  jobStore: JobStore;
  close(): Promise<void>;
}

// The one place the database is set up. Supporting MongoDB means branching on
// DB_DRIVER here and returning stores that implement the same interfaces; routes and
// scoring stay untouched.
export async function createStores(database: DatabaseConfig): Promise<Stores> {
  const db = PostgresDatabase.getInstance(database.DATABASE_URL);
  await db.ensureSchema();

  return {
    candidateStore: createPostgresCandidateStore(db),
    jobStore: createPostgresJobStore(db),
    close: () => db.close(),
  };
}
