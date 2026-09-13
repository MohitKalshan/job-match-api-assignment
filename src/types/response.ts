// The one shape every endpoint returns, success or failure. `data` is always an
// array: a single entity is a one-element array, an error is empty. Clients get to
// write one parser.
export interface ApiResponse<T> {
  statusCode: number;
  data: T[];
  message: string;
}

// A single validation problem, carried in `data` on a 400 so the same list parser
// works on success and failure.
export interface FieldError {
  field: string;
  message: string;
}
