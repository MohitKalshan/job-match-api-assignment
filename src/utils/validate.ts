import type { Response } from "express";
import { z } from "zod";

export function parseOrRespond<T extends z.ZodType>(
  schema: T,
  data: unknown,
  res: Response,
): z.infer<T> | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    res.status(400).json({ error: z.flattenError(result.error) });
    return undefined;
  }
  return result.data;
}
