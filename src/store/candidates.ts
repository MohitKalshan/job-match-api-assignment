import { randomUUID } from "node:crypto";
import type { Candidate, CreateCandidate } from "../types/candidate.js";

const candidates = new Map<string, Candidate>();

export function createCandidate(data: CreateCandidate): Candidate {
  const candidate: Candidate = { id: randomUUID(), ...data };
  candidates.set(candidate.id, candidate);
  return candidate;
}

export function getCandidateById(id: string): Candidate | undefined {
  return candidates.get(id);
}

export function listCandidates(): Candidate[] {
  return Array.from(candidates.values());
}
