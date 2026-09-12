import { Router } from "express";
import { createCandidateSchema } from "../schemas/candidate.js";
import { recommendationQuerySchema } from "../schemas/recommendation.js";
import type { CandidateStore, JobStore } from "../types/store.js";
import {
  rankJobsForCandidate,
  resolveWeights,
  weightOverridesFromQuery,
} from "../scoring/job-match.js";
import { NotFoundError } from "../errors/http-errors.js";
import { respond } from "../utils/respond.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Takes its stores rather than importing concretes, so the composition root picks the
// implementation and tests can substitute their own.
export function createCandidatesRouter(candidateStore: CandidateStore, jobStore: JobStore): Router {
  const router = Router();

  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const data = createCandidateSchema.parse(req.body);
      const candidate = candidateStore.create(data);

      respond(res, 201, [candidate], "Candidate created");
    }),
  );

  router.get(
    "/:id/recommendations",
    asyncHandler<{ id: string }>(async (req, res) => {
      const candidate = candidateStore.getById(req.params.id);
      if (!candidate) throw new NotFoundError("Candidate not found");

      const query = recommendationQuerySchema.parse(req.query);
      const weights = resolveWeights(weightOverridesFromQuery(query));
      const ranked = rankJobsForCandidate(candidate, jobStore.list(), weights).map(
        ({ job, score, breakdown }) => ({
          jobId: job.id,
          title: job.title,
          score,
          breakdown,
        }),
      );
      const results = ranked.slice(0, query.limit);

      const noun = results.length === 1 ? "job recommendation" : "job recommendations";
      respond(res, 200, results, `Found ${results.length} ${noun}`);
    }),
  );

  return router;
}
