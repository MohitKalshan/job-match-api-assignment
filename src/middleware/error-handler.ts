import type { ErrorRequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../errors/http-errors.js";
import type { FieldError } from "../types/response.js";
import { respond } from "../utils/respond.js";

// `z.flattenError` returns { formErrors, fieldErrors }, which doesn't fit an array of
// { field, message } — so walk the issues directly. A root-level issue has an empty
// path; call it "body".
function toFieldErrors(err: z.ZodError): FieldError[] {
  return err.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

// Four arguments is what makes this error middleware rather than ordinary middleware;
// `_next` is unused but must stay for the arity.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    respond(res, 400, toFieldErrors(err), "Validation failed");
    return;
  }

  if (err instanceof HttpError) {
    respond(res, err.statusCode, [], err.message);
    return;
  }

  // express.json() rejects an unparseable body with a SyntaxError carrying the raw body.
  if (err instanceof SyntaxError && "body" in err) {
    respond(res, 400, [], "Request body is not valid JSON");
    return;
  }

  // Log server-side, return something generic: stack traces and internals never reach clients.
  console.error(err);
  respond(res, 500, [], "Something went wrong");
};
