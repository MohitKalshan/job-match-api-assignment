import { randomUUID } from "node:crypto";
import type { Job } from "../types/job.js";
import type { JobStore } from "../types/store.js";
import type { Database } from "./database.js";

export function createInMemoryJobStore(db: Database): JobStore {
  return {
    create(data) {
      const job: Job = { ...data, id: randomUUID() };
      db.jobs.set(job.id, job);
      return job;
    },
    getById(id) {
      return db.jobs.get(id);
    },
    list() {
      return Array.from(db.jobs.values());
    },
  };
}
