import { randomUUID } from "node:crypto";
import type { Candidate } from "../../types/candidate.js";
import type { CandidateStore } from "../../types/store.js";
import type { MemoryDatabase } from "./database.js";

export function createInMemoryCandidateStore(db: MemoryDatabase): CandidateStore {
  return {
    async create(data) {
      const candidate: Candidate = { ...data, id: randomUUID() };
      db.candidates.set(candidate.id, candidate);
      return candidate;
    },
    async getById(id) {
      return db.candidates.get(id);
    },
    async list() {
      return Array.from(db.candidates.values());
    },
  };
}
