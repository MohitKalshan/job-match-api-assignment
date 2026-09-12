import { randomUUID } from "node:crypto";
import type { Candidate } from "../types/candidate.js";
import type { CandidateStore } from "../types/store.js";

export function createInMemoryCandidateStore(): CandidateStore {
  const candidates = new Map<string, Candidate>();

  return {
    create(data) {
      const candidate: Candidate = { ...data, id: randomUUID() };
      candidates.set(candidate.id, candidate);
      return candidate;
    },
    getById(id) {
      return candidates.get(id);
    },
    list() {
      return Array.from(candidates.values());
    },
  };
}
