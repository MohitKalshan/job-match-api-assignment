import type { DatabaseConfig } from "../config/env.js";
import type { CandidateStore, JobStore } from "../types/store.js";
import { MemoryDatabase } from "./memory/database.js";
import { createInMemoryCandidateStore } from "./memory/candidates.js";
import { createInMemoryJobStore } from "./memory/jobs.js";
import { PostgresDatabase } from "./postgres/database.js";
import { createPostgresCandidateStore } from "./postgres/candidates.js";
import { createPostgresJobStore } from "./postgres/jobs.js";

export interface Stores {
  candidateStore: CandidateStore;
  jobStore: JobStore;
  close(): Promise<void>;
}

// The one place a database is chosen. Supporting MongoDB means adding a `mongo` case that
// returns stores implementing the same interfaces; routes and scoring stay untouched.
export async function createStores(database: DatabaseConfig): Promise<Stores> {
  switch (database.DB_DRIVER) {
    case "postgres": {
      const db = PostgresDatabase.getInstance(database.DATABASE_URL);
      await db.ensureSchema();
      return {
        candidateStore: createPostgresCandidateStore(db),
        jobStore: createPostgresJobStore(db),
        close: () => db.close(),
      };
    }
    case "memory": {
      const db = MemoryDatabase.getInstance();
      return {
        candidateStore: createInMemoryCandidateStore(db),
        jobStore: createInMemoryJobStore(db),
        close: async () => {},
      };
    }
  }
}
