import express, { type Express } from "express";
import { createCandidatesRouter } from "./routes/candidates.js";
import { createJobsRouter } from "./routes/jobs.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { respond } from "./utils/respond.js";
import type { CandidateStore, JobStore } from "./types/store.js";

export interface Deps {
  candidateStore: CandidateStore;
  jobStore: JobStore;
}

// A factory, so tests can build an app over test doubles without binding a port.
// Concrete stores are chosen in index.ts, never here.
export function createApp({ candidateStore, jobStore }: Deps): Express {
  const app = express();

  // The default body limit invites memory exhaustion; this must be registered before
  // anything that reads req.body.
  app.use(express.json({ limit: "100kb" }));

  app.get("/", (_req, res) => {
    respond(res, 200, [], "Server is running");
  });

  app.use("/candidates", createCandidatesRouter(candidateStore, jobStore));
  app.use("/jobs", createJobsRouter(jobStore, candidateStore));

  // Order is load-bearing and invisible: 404 after the routes, error handler last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
