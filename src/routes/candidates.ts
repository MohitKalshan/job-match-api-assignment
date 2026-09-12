import { Router } from "express";
import { createCandidateSchema } from "../schemas/candidate.js";
import { recommendationQuerySchema } from "../schemas/recommendation.js";
import { createCandidate, getCandidateById } from "../store/candidates.js";
import { listJobs } from "../store/jobs.js";
import { computeJobMatch } from "../scoring/job-match.js";
import { parseOrRespond } from "../utils/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const candidatesRouter = Router();

candidatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = parseOrRespond(createCandidateSchema, req.body, res);
    if (!data) return;

    const candidate = createCandidate(data);
    res.status(201).json(candidate);
  }),
);

candidatesRouter.get(
  "/:id/recommendations",
  asyncHandler<{ id: string }>(async (req, res) => {
    const candidate = getCandidateById(req.params.id);
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    const query = parseOrRespond(recommendationQuerySchema, req.query, res);
    if (!query) return;

    const ranked = listJobs()
      .map((job) => {
        const { score, breakdown } = computeJobMatch(candidate, job);
        return { jobId: job.id, title: job.title, score, breakdown };
      })
      .sort((a, b) => b.score - a.score);

    res.json(query.limit ? ranked.slice(0, query.limit) : ranked);
  }),
);
