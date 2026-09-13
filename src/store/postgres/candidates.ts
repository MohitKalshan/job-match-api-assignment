import { randomUUID } from "node:crypto";
import type { Candidate } from "../../types/candidate.js";
import type { CandidateStore } from "../../types/store.js";
import type { PostgresDatabase } from "./database.js";

interface CandidateRow {
  id: string;
  name: string;
  skills: string[];
  years_of_experience: string;
  location: string;
  expected_salary: string;
}

const COLUMNS = "id, name, skills, years_of_experience, location, expected_salary";

// Column names stop here. pg returns NUMERIC as a string, so convert to numbers:
// "5" + 2 would silently give "52" in the scorer.
function toCandidate(row: CandidateRow): Candidate {
  return {
    id: row.id,
    name: row.name,
    skills: row.skills,
    yearsOfExperience: Number(row.years_of_experience),
    location: row.location,
    expectedSalary: Number(row.expected_salary),
  };
}

export function createPostgresCandidateStore(db: PostgresDatabase): CandidateStore {
  return {
    async create(data) {
      const { rows } = await db.pool.query<CandidateRow>(
        `INSERT INTO candidates (${COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          data.name,
          data.skills,
          data.yearsOfExperience,
          data.location,
          data.expectedSalary,
        ],
      );
      return toCandidate(rows[0]!);
    },

    async getById(id) {
      const { rows } = await db.pool.query<CandidateRow>(
        `SELECT ${COLUMNS} FROM candidates WHERE id = $1`,
        [id],
      );
      return rows[0] ? toCandidate(rows[0]) : undefined;
    },

    async list() {
      const { rows } = await db.pool.query<CandidateRow>(
        `SELECT ${COLUMNS} FROM candidates ORDER BY created_at, id`,
      );
      return rows.map(toCandidate);
    },
  };
}
