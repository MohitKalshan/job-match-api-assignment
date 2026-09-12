# CLAUDE.md — Node + Express Conventions

A reusable baseline. Drop into a project root, delete what doesn't apply, add the
project-specific bits at the top.

Express is unopinionated, which means every convention below has to be _maintained_
rather than inherited. A framework like NestJS or Spring Boot enforces layering for you;
Express will happily let a route handler open a database connection and do arithmetic.
That freedom is why Express codebases rot in predictable ways, and why this file exists.

---

## Commands

```bash
npm run dev        # tsx watch
npm test
npm run typecheck  # tsc --noEmit
npm run lint
```

Run `npm test && npm run typecheck` before declaring work done. Code that looks correct
is not evidence that it is.

---

## Layering

```
src/
  domain/        types and business rules — imports NOTHING from infrastructure
  services/      use cases; orchestrates domain + repositories
  repository/    data access; interface + implementations
  api/
    routes/      thin handlers
    schemas/     Zod validation at the boundary
    middleware/  auth, logging, error handling
  config/        env parsing, one place
  server.ts      composition root — the only file that wires concretes together
```

**Dependencies point inward.** `domain` knows nothing. `services` know `domain`.
`api` knows `services`. Nothing inward imports Express, the database driver, or
`process.env`.

**The test for whether layering is real:** can you unit-test the business logic without
starting a server or a database? If not, the logic is entangled with delivery and the
layering is decorative.

### Route handlers stay thin

A handler does four things: validate input, call a service, shape the response, done.

```ts
// Good
router.post(
  "/orders",
  asyncHandler(async (req, res) => {
    const input = createOrderSchema.parse(req.body);
    const order = await orderService.create(input);
    res.status(201).json(toOrderResponse(order));
  }),
);
```

If arithmetic, business rules, or `if` chains about domain state appear in
`src/api/`, they belong in a service or the domain.

### The composition root

Concrete implementations are chosen in exactly one file (`server.ts`). Everything else
receives its dependencies. No `new PostgresRepository()` scattered through the codebase,
no module-level singletons that tests can't replace.

---

## The Express traps

These are the ones that actually cause outages.

### 1. Async errors (Express 4)

Express 4 does not catch rejected promises. An unhandled rejection in a handler hangs
the request until the client times out — no 500, no log.

```ts
export const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
```

Wrap every async handler. Express 5 forwards rejections automatically — if you're on 5,
confirm it rather than assuming.

### 2. The error handler needs four arguments

```ts
app.use((err, req, res, next) => { ... });  // 4 args = error middleware
app.use((err, req, res) => { ... });        // 3 args = a normal middleware, silently
```

Express identifies error middleware by arity. Drop `next` and it stops being an error
handler, with no warning. If you're in TypeScript and tempted to remove the unused
parameter, prefix it: `_next`.

### 3. Middleware order matters and is invisible

The error handler goes **last**, after routes. The 404 handler goes after routes but
before the error handler. `express.json()` goes before anything that reads `req.body`.
Get the order wrong and the symptom is a silent behavioural change, not an error.

### 4. Don't send twice

```ts
if (!user) {
  res.status(404).json({ error: "NotFound" });
  return; // without this, execution continues
}
res.json(user); // ERR_HTTP_HEADERS_SENT
```

Always `return` after responding.

### 5. Unbounded queries

Any list endpoint gets a `limit` with a default and a hard cap. `?limit=999999`
otherwise dumps the table and takes the process with it.

---

## Validation

**Validate at the boundary, once.** Zod (or equivalent) parses `req.body`, `req.params`
and `req.query` in the route. Inward of that, data is known-good and correctly typed.

Corollary: **do not add defensive checks in services or domain code.** They are
unreachable, and they imply the boundary can't be trusted — which invites someone to
bypass it.

```ts
const createUserSchema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(150),
});
type CreateUserInput = z.infer<typeof createUserSchema>;
```

Derive types from schemas rather than declaring both. Two hand-maintained definitions
drift.

`req.query` values are always strings — use `z.coerce.number()`, not `z.number()`.

---

## Error handling

One error middleware translates thrown errors into HTTP responses. Route handlers never
branch on status codes.

```ts
export class NotFoundError extends Error {
  /* ... */
}
export class ConflictError extends Error {
  /* ... */
}
```

```ts
export function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError)     return res.status(400).json({ ... });
  if (err instanceof NotFoundError) return res.status(404).json({ ... });

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' });
}
```

**Never leak internals.** Stack traces, SQL text, and driver messages do not go to
clients — log them server-side, return something generic. A 500 body that includes the
failing query is an information-disclosure bug.

Every error response shares one shape. Clients parse these programmatically.

---

## Configuration

All config comes from the environment, parsed and validated **once** at startup, in one
module. Never `process.env.FOO` scattered through the codebase.

```ts
const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});
export const config = envSchema.parse(process.env);
```

Fail fast: a missing `DATABASE_URL` should crash on boot with a clear message, not
produce a confusing error on the first request an hour later.

Commit `.env.example`, never `.env`.

---

## Database

- **Connection pool, not per-request connections.** One pool for the process lifetime.
- **Parameterised queries always.** String interpolation into SQL is an injection
  vulnerability, with no exceptions for "internal" values.
- **Map rows to domain objects at the repository boundary**, so column names never leak
  upward. `user.created_at` appearing in a service is a layering breach.
- **`pg` returns NUMERIC as a string** to avoid precision loss. Convert in the mapper —
  `"5" - 2` behaves, `"5" + 2` gives `"52"`, and the bug surfaces as wrong data rather
  than a crash.
- **Transactions for multi-statement writes**, with the client released in a `finally`.
- Prefer raw SQL for simple schemas; reach for an ORM when relations and migrations
  genuinely justify it.

---

## TypeScript

```jsonc
{
  "strict": true,
  "noUncheckedIndexedAccess": true, // arr[0] is T | undefined — it always was
  "noImplicitOverride": true,
}
```

No `any` in domain or service code. `unknown` plus a narrowing check where a type is
genuinely unknown.

Prefer `type`/`interface` definitions derived from schemas over duplicating shapes.

---

## Testing

**Pyramid, weighted toward the bottom:**

- **Unit tests** on domain and services. Pure, fast, no server, no database. This is
  where business rules are tested and where most of your tests should be.
- **Integration tests** on routes via `supertest` against an app built with in-memory or
  test doubles. Covers wiring, validation, status codes.
- **A thin end-to-end layer** against a real database, if at all.

Build the app with a factory so tests never bind a port:

```ts
export function createApp(deps: Deps): Express { ... }
// tests: request(createApp(testDeps)).post('/orders')...
```

**Test behaviour, not implementation.** Assert the response and the resulting state, not
that a particular private method was called. Tests coupled to implementation break on
every refactor and stop being maintained.

Every bug gets a regression test that fails on the old code.

---

## Security baseline

- `helmet()` for default headers.
- Explicit CORS allowlist, never `origin: '*'` on an authenticated API.
- Rate limiting on public endpoints.
- Cap body size: `express.json({ limit: '100kb' })`. The default invites memory
  exhaustion.
- Secrets from the environment, never committed, never logged.
- Never log request bodies wholesale — they contain passwords and tokens.
- `npm audit` in CI.

---

## Logging

Structured JSON (`pino`), never `console.log` in production paths. Include a request id
so a single request's lines can be correlated. Log at the boundary — one line per
request in, one per request out — not at every layer, which produces noise nobody reads.

---

## Graceful shutdown

```ts
process.on("SIGTERM", async () => {
  server.close(() => {
    /* stop accepting */
  });
  await pool.end();
  process.exit(0);
});
```

Without this, a container restart kills in-flight requests and leaves connections open.
It matters the moment anything is orchestrated.

---

## Design principles, as they apply to Express

**KISS** — Express's flexibility tempts elaborate middleware chains and dynamic route
registration. Prefer explicit routes you can grep for over clever generation you have to
reason about.

**YAGNI** — applies to features, never to layering or tests. "We aren't gonna need a
service layer" is a shortcut wearing YAGNI's badge. Skip the caching layer; don't skip
the seam that makes testing possible.

**DRY** — about knowledge, not text. One definition of a business rule, always. Two
route handlers with similar plumbing are usually fine; abstracting coincidental
similarity produces indirection that costs more than the duplication did. Deliberate
duplication across _layers_ (a validation rule in Zod and as a database constraint) is
correct — different failure modes, different guarantees.

**SRP** — one reason to change. A module that changes when the pricing rule changes _and_
when the response format changes is doing two jobs.

**OCP** — pays off where extension is frequent and the variation points are known.
Applied speculatively it is over-engineering with a principle's name on it. A plugin
registry for a list that has never changed is a cost, not a design.

**LSP** — the trap in Node is that behavioural contracts aren't in the type signature.
Two implementations of a repository interface can both typecheck while one throws on a
duplicate key and the other silently overwrites; no caller can be correct against both.
Write one contract test suite and run it against every implementation — that suite _is_
the contract.

**DIP** — depend on the interface, choose the concrete once in `server.ts`. This is what
makes tests possible without a database, and it is the highest-value principle in the
list for an Express project specifically.

---

## Working style

Explain reasoning, don't just produce output. Where a decision has real trade-offs, lay
out the options and consequences rather than silently picking one.

Flag code smells and mistakes directly rather than softening them into suggestions.

Don't add a dependency without saying why the standard library or a few lines of your
own were rejected.

Update docs in the same change as the code. Documentation that trails behind is worse
than none, because it argues confidently for decisions already abandoned.
