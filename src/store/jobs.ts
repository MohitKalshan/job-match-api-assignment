import { randomUUID } from "node:crypto";
import type { Job } from "../types/job.js";
import type { JobStore } from "../types/store.js";

export function createInMemoryJobStore(): JobStore {
  const jobs = new Map<string, Job>();

  return {
    create(data) {
      const job: Job = { ...data, id: randomUUID() };
      jobs.set(job.id, job);
      return job;
    },
    getById(id) {
      return jobs.get(id);
    },
    list() {
      return Array.from(jobs.values());
    },
  };
}
