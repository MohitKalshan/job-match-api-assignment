import { z } from "zod";

// All configuration, parsed and validated once at startup. A bad or missing value crashes
// on boot with a clear message rather than failing on the first request.

// One branch per supported database. Add a `mongo` branch here when a MongoDB store exists.
const databaseSchema = z.discriminatedUnion("DB_DRIVER", [
  z.object({ DB_DRIVER: z.literal("memory") }),
  z.object({
    DB_DRIVER: z.literal("postgres"),
    DATABASE_URL: z.string({ error: "DATABASE_URL is required when DB_DRIVER=postgres" }).min(1),
  }),
]);

const serverSchema = z.object({
  PORT: z.coerce.number().default(3000),
});

export type DatabaseConfig = z.infer<typeof databaseSchema>;

const env = { ...process.env, DB_DRIVER: process.env.DB_DRIVER ?? "memory" };

export const config = {
  ...serverSchema.parse(env),
  database: databaseSchema.parse(env),
};
