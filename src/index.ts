import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { createStores } from "./store/index.js";

// The composition root: the only file that picks concrete implementations.
const stores = await createStores(config.database);

const app = createApp({
  candidateStore: stores.candidateStore,
  jobStore: stores.jobStore,
});

const server = app.listen(config.PORT, () => {
  console.log(`Server listening on port ${config.PORT} (database: ${config.database.DB_DRIVER})`);
});

// Stop accepting requests, let in-flight ones finish, then release database connections.
function shutdown(): void {
  server.close(async () => {
    await stores.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
