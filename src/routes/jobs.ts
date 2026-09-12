import { Router } from "express";
import { createJobSchema } from "../schemas/job.js";
import { recommendationQuerySchema } from "../schemas/recommendation.js";
import type { CandidateStore, JobStore } from "../types/store.js";
import {
  rankCandidatesForJob,
  resolveWeights,
  weightOverridesFromQuery,
} from "../scoring/job-match.js";
import { NotFoundError } from "../errors/http-errors.js";
import { respond } from "../utils/respond.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Takes its stores rather than importing concretes, so the composition root picks the
// implementation and tests can substitute their own.
export function createJobsRouter(jobStore: JobStore, candidateStore: CandidateStore): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = createJobSchema.parse(req.body);
      const job = jobStore.create(data);

      respond(res, 201, [job], "Job created");
    }),
  );

  router.get(
    "/:id/recommendations",
    asyncHandler<{ id: string }>(async (req, res) => {
      const job = jobStore.getById(req.params.id);
      if (!job) throw new NotFoundError("Job not found");

      const query = recommendationQuerySchema.parse(req.query);
      const weights = resolveWeights(weightOverridesFromQuery(query));
      const ranked = rankCandidatesForJob(job, candidateStore.list(), weights).map(
        ({ candidate, score, breakdown }) => ({
          candidateId: candidate.id,
          name: candidate.name,
          score,
          breakdown,
        }),
      );
      const results = ranked.slice(0, query.limit);

      const noun = results.length === 1 ? "candidate recommendation" : "candidate recommendations";
      respond(res, 200, results, `Found ${results.length} ${noun}`);
    }),
  );

  return router;
}
