import { Router } from "express";
import { createJobSchema } from "../schemas/job.js";
import { recommendationQuerySchema } from "../schemas/recommendation.js";
import { createJob, getJobById } from "../store/jobs.js";
import { listCandidates } from "../store/candidates.js";
import { rankCandidatesForJob } from "../scoring/job-match.js";
import { parseOrRespond } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const jobsRouter = Router();

jobsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseOrRespond(createJobSchema, req.body, res);
    if (!data) return;

    const job = createJob(data);
    res.status(201).json(job);
  }),
);

jobsRouter.get(
  "/:id/recommendations",
  asyncHandler<{ id: string }>(async (req, res) => {
    const job = getJobById(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const query = parseOrRespond(recommendationQuerySchema, req.query, res);
    if (!query) return;

    const ranked = rankCandidatesForJob(job, listCandidates()).map(
      ({ candidate, score, breakdown }) => ({
        candidateId: candidate.id,
        name: candidate.name,
        score,
        breakdown,
      }),
    );

    res.json(query.limit ? ranked.slice(0, query.limit) : ranked);
  }),
);
