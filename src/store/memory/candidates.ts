import { randomUUID } from "node:crypto";
import type { Candidate } from "../types/candidate.js";
import type { CandidateStore } from "../types/store.js";
import type { Database } from "./database.js";

export function createInMemoryCandidateStore(db: Database): CandidateStore {
  return {
    create(data) {
      const candidate: Candidate = { ...data, id: randomUUID() };
      db.candidates.set(candidate.id, candidate);
      return candidate;
    },
    getById(id) {
      return db.candidates.get(id);
    },
    list() {
      return Array.from(db.candidates.values());
    },
  };
}
