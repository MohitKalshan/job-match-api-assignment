import { z } from "zod";

// All configuration, parsed and validated once at startup. A bad or missing value crashes
// on boot with a clear message rather than failing on the first request.

// Postgres is the only database today. To support MongoDB, turn this into a
// z.discriminatedUnion on DB_DRIVER with a `mongo` branch.
const databaseSchema = z.object({
  DB_DRIVER: z.literal("postgres"),
  DATABASE_URL: z.string({ error: "DATABASE_URL is required" }).min(1, "DATABASE_URL is required"),
});

const serverSchema = z.object({
  PORT: z.coerce.number().default(3000),
});

export type DatabaseConfig = z.infer<typeof databaseSchema>;

const env = { ...process.env, DB_DRIVER: process.env.DB_DRIVER ?? "postgres" };

export const config = {
  ...serverSchema.parse(env),
  database: databaseSchema.parse(env),
};
