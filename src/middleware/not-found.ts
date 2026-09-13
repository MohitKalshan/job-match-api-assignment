import type { RequestHandler } from "express";
import { NotFoundError } from "../errors/http-errors.js";

// Registered after the routes and before the error handler. It throws rather than
// responding so the envelope is built in exactly one place.
export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Cannot ${req.method} ${req.path}`);
};
