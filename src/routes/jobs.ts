import { Router } from "express";
import { z } from "zod";
import { createJobSchema } from "../schemas/job.js";
import { createJob } from "../store/jobs.js";

export const jobsRouter = Router();

jobsRouter.post("/", (req, res) => {
  const result = createJobSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const job = createJob(result.data);
  res.status(201).json(job);
});
