import { randomUUID } from "node:crypto";
import type { Job } from "../../types/job.js";
import type { JobStore } from "../../types/store.js";
import type { MemoryDatabase } from "./database.js";

export function createInMemoryJobStore(db: MemoryDatabase): JobStore {
  return {
    async create(data) {
      const job: Job = { ...data, id: randomUUID() };
      db.jobs.set(job.id, job);
      return job;
    },
    async getById(id) {
      return db.jobs.get(id);
    },
    async list() {
      return Array.from(db.jobs.values());
    },
  };
}
