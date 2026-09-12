import { randomUUID } from "node:crypto";
import type { Job, CreateJob } from "../types/job.js";

const jobs = new Map<string, Job>();

export function createJob(data: CreateJob): Job {
  const job: Job = { id: randomUUID(), ...data };
  jobs.set(job.id, job);
  return job;
}

export function listJobs(): Job[] {
  return Array.from(jobs.values());
}

export function getJobById(id: string): Job | undefined {
  return jobs.get(id);
}
