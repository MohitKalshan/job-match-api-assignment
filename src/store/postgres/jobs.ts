import { randomUUID } from "node:crypto";
import type { Job, RequiredSkill } from "../../types/job.js";
import type { JobStore } from "../../types/store.js";
import type { PostgresDatabase } from "./database.js";

interface JobRow {
  id: string;
  title: string;
  required_skills: RequiredSkill[];
  min_years_experience: string;
  location: string;
  salary_min: string;
  salary_max: string;
  remote_allowed: boolean;
}

const COLUMNS =
  "id, title, required_skills, min_years_experience, location, salary_min, salary_max, remote_allowed";

// Column names stop here. pg returns NUMERIC as a string, so convert to numbers.
function toJob(row: JobRow): Job {
  return {
    id: row.id,
    title: row.title,
    requiredSkills: row.required_skills,
    minYearsExperience: Number(row.min_years_experience),
    location: row.location,
    salaryRange: { min: Number(row.salary_min), max: Number(row.salary_max) },
    remoteAllowed: row.remote_allowed,
  };
}

export function createPostgresJobStore(db: PostgresDatabase): JobStore {
  return {
    async create(data) {
      const { rows } = await db.pool.query<JobRow>(
        `INSERT INTO jobs (${COLUMNS})
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLUMNS}`,
        [
          randomUUID(),
          data.title,
          // pg would send a JS array as a Postgres array, so serialize it for JSONB.
          JSON.stringify(data.requiredSkills),
          data.minYearsExperience,
          data.location,
          data.salaryRange.min,
          data.salaryRange.max,
          data.remoteAllowed,
        ],
      );
      return toJob(rows[0]!);
    },

    async getById(id) {
      const { rows } = await db.pool.query<JobRow>(`SELECT ${COLUMNS} FROM jobs WHERE id = $1`, [
        id,
      ]);
      return rows[0] ? toJob(rows[0]) : undefined;
    },

    async list() {
      const { rows } = await db.pool.query<JobRow>(
        `SELECT ${COLUMNS} FROM jobs ORDER BY created_at, id`,
      );
      return rows.map(toJob);
    },
  };
}
