import pg from "pg";

// Singleton Postgres connection pool: one pool for the whole process, never a connection per
// request. The private constructor means getInstance() is the only way to get one.
export class PostgresDatabase {
  private static instance: PostgresDatabase | undefined;

  readonly pool: pg.Pool;

  private constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString });
  }

  static getInstance(connectionString: string): PostgresDatabase {
    if (!PostgresDatabase.instance) {
      PostgresDatabase.instance = new PostgresDatabase(connectionString);
    }
    return PostgresDatabase.instance;
  }

  // Creates the tables on first start; safe to run on every boot.
  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id                  TEXT PRIMARY KEY,
        name                TEXT NOT NULL,
        skills              TEXT[] NOT NULL,
        years_of_experience NUMERIC NOT NULL,
        location            TEXT NOT NULL,
        expected_salary     NUMERIC NOT NULL,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS jobs (
        id                   TEXT PRIMARY KEY,
        title                TEXT NOT NULL,
        required_skills      JSONB NOT NULL,
        min_years_experience NUMERIC NOT NULL,
        location             TEXT NOT NULL,
        salary_min           NUMERIC NOT NULL,
        salary_max           NUMERIC NOT NULL,
        remote_allowed       BOOLEAN NOT NULL,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  }

  async close(): Promise<void> {
    await this.pool.end();
    PostgresDatabase.instance = undefined;
  }
}
