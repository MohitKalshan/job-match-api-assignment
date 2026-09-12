import { Router } from "express";
import { createJobSchema } from "../schemas/job.js";
import { createJob } from "../store/jobs.js";
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
