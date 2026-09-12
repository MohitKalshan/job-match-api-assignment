import { Router } from "express";
import { z } from "zod";
import { createCandidateSchema } from "../schemas/candidate.js";
import { createCandidate } from "../store/candidates.js";

export const candidatesRouter = Router();

candidatesRouter.post("/", (req, res) => {
  const result = createCandidateSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return;
  }

  const candidate = createCandidate(result.data);
  res.status(201).json(candidate);
});
