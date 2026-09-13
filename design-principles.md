# Design Principles, Applied to This Codebase

Every example below is real code from this repo — including the places where a
principle was deliberately broken, and one place where it was broken by accident.

That matters more than the definitions. Everyone can recite DRY. The skill being tested
in interviews is knowing when applying it makes the code worse.

---

## KISS — Keep It Simple

**The principle:** prefer the solution a stranger can read over the one that shows how
much you know.

**Where this project applies it: raw `pg` instead of an ORM.**

The schema is two tables with no relations between them. An ORM earns its keep at
schema complexity this project does not have, and Prisma's generate step inside a
multi-stage Docker build is a well-known source of lost hours.

The defensible version of this argument is never "ORMs are bad." It is: _this_ schema
does not have the problem an ORM solves, so adopting one buys complexity with no
matching benefit.

**Where it's tempting to over-apply:** KISS is not an excuse to skip structure. The
simplest possible version of this project is one 400-line `server.ts` — and it would be
untestable, because the scoring logic would be welded to Express. Simple means _few
concepts_, not _few files_. Five small files with one job each are simpler than one file
doing five things.

---

## YAGNI — You Aren't Gonna Need It

**The principle:** build for the requirement in front of you, not the one you imagine
arriving later.

**Where this project applies it:**

- No migration tool. `schema.sql` runs once on container init. A migration framework
  solves schema evolution across environments — a problem a take-home does not have.
- No pagination beyond `limit`. No cursors, no offsets.
- Skills stored as JSONB rather than normalised into join tables.
- No caching layer, no rate limiting, no auth (explicitly out of scope).

**The distinction that makes YAGNI defensible in an interview:** it applies to
_features_, not to _design quality_. "We aren't gonna need tests" and "we aren't gonna
need layering" are not YAGNI, they are shortcuts wearing its badge. YAGNI says skip the
thing you don't need yet; it never says make the thing you do need worse.

**Where this project deliberately violates it:** the `Repository` interface with two
implementations. Strict YAGNI says ship one. It's here because it was the fallback plan
— if the Postgres setup had overrun its timebox, `STORAGE=memory` keeps the project
shippable. A hedge against a _known, likely_ risk is not speculative generality. A hedge
against an imagined one is.

---

## DRY — Don't Repeat Yourself

**The principle, stated properly:** every piece of _knowledge_ has a single
authoritative representation. It is about knowledge, not about text that looks similar.
Most DRY damage comes from people deduplicating text.

**Where this project applies it well: `scoreMatch` serves both directions.**

`GET /candidates/:id/recommendations` and `GET /jobs/:id/recommendations` both call the
same scorer with the arguments flipped. There is exactly one definition of what a good
match is. If two scorers existed, they would drift, and the reverse view would quietly
start disagreeing with the forward one.

**Where this project deliberately violates it:** `recommendJobsForCandidate` and
`recommendCandidatesForJob` in `src/scoring/recommend.ts` are near-identical — same
filter, same map, same sort, same slice. Textbook DRY says abstract them into one
generic function.

They are not abstracted, on purpose. Look at what that abstraction would need: a generic
over two type parameters, a callback to extract the id, a callback to build the result
shape, and a signature nobody reads at a glance. Roughly twelve lines of duplicated,
obvious code replaced by eight lines of indirection that is harder to follow than what
it removed.

The knowledge is not duplicated — `scoreMatch` and `isEligible` hold all of it. Only the
plumbing repeats. **That is the distinction worth being able to articulate: duplicated
text is cheap, duplicated knowledge is expensive.**

**A deliberate duplication that is correct:** the rule `salary.max >= salary.min` exists
in _both_ the Zod schema and the Postgres `CHECK` constraint. That is not a DRY
violation to fix. They are different layers guarding different failure modes — Zod gives
a client a readable 400, the constraint protects data integrity against any writer that
bypasses the API. Removing either weakens the system.

---

## SOLID

### S — Single Responsibility

**Applied:** one file per scoring dimension. `salary.ts` knows only how expectation
relates to a band. It does not know about weights, rounding, or the other dimensions.

The practical payoff is in the tests. When the salary rule changed, one file changed and
one test file changed. Nothing else could possibly have broken.

**The common misreading:** "a class should do one thing" leads to classes with one
method and no cohesion. The better phrasing is _one reason to change_. `scoreSalary`
changes when the salary rule changes — and for no other reason. That's the test.

### O — Open/Closed

**Honestly: this project does not satisfy it, and that's the right call.**

Adding a fifth dimension means editing `scoreMatch`, `ScoreBreakdown`, and
`ScoringWeights`. A properly open/closed design would have dimensions as a registry of
pluggable scorers that you extend without touching existing code.

That design is worse here. It would trade four explicit, readable, individually typed
fields for a loop over a collection — losing type safety on the breakdown shape, making
the response harder to construct, and buying extensibility for a dimension list that has
changed zero times.

**The interview-grade version of this answer:** OCP pays off where extension is
frequent and the extension points are known. Applied speculatively, it is
over-engineering with a principle's name attached. Four dimensions defined by a
specification are not a variation point.

### L — Liskov Substitution

**The principle:** any implementation of an interface must be usable wherever that
interface is expected, without the caller needing to know which one it got.

**This project has a real, unfixed violation. Find it:**

```ts
// InMemoryRepository
async createCandidate(candidate: Candidate): Promise<Candidate> {
  this.candidates.set(candidate.id, candidate);   // duplicate id silently overwrites
  return candidate;
}

// PostgresRepository
async createCandidate(candidate: Candidate): Promise<Candidate> {
  await this.pool.query(`INSERT INTO candidates (id, ...) VALUES ($1, ...)`);
  return candidate;                                // duplicate id throws on PK conflict
}
```

Same interface, same signature, and both typecheck. But insert a duplicate id and one
silently replaces the record while the other throws. **A caller cannot be written that
is correct against both.** That is exactly what LSP prohibits — the contract is not in
the signature, it is in the behaviour, and the behaviours differ.

It has not bitten this project because ids are server-generated UUIDs, so duplicates
never occur in practice. That is luck, not design: the bug is latent, waiting for the
first code path that supplies its own id.

A second, subtler one in the same class: `getCandidate` in memory returns _the stored
object reference_, so a caller that mutates the result mutates the store. Postgres
returns a fresh object every time. Same interface, different aliasing semantics.

**Why this is the most useful SOLID letter for interviews:** violations are invisible to
the type system. The compiler is satisfied, the tests pass, and the defect surfaces only
when someone swaps the implementation. A candidate who can point at a real example like
this is demonstrably ahead of one who recites the rectangle/square problem.

_Fixing it:_ the interface needs a stated contract — "throws `DuplicateIdError` on an
existing id, returns a defensive copy" — and the in-memory implementation needs to
honour it. Then write one test suite and run it against both implementations. That
shared suite _is_ the contract, in executable form.

### I — Interface Segregation

**Partially violated, and worth knowing why.**

`Repository` has six methods. The recommendation path needs `getCandidate` and
`listJobs`; it is forced to depend on the create methods too. Strict ISP says split it —
`CandidateReader`, `CandidateWriter`, and so on.

Not done, because at six cohesive methods the segregation costs more in indirection than
it saves in coupling. ISP earns its keep when a fat interface forces implementers to
stub out methods they cannot meaningfully support. Nothing here is stubbed.

**The line to be able to draw:** ISP is about not forcing clients to depend on methods
they don't use. The cost only becomes real when the interface is large enough that
implementers start throwing `NotImplemented`. Until then, splitting is speculative.

### D — Dependency Inversion

**Applied, and it is the reason the project is testable.**

`createRoutes(repository: Repository)` depends on the interface, never on
`PostgresRepository`. The concrete choice is made once, in `server.ts`, from an
environment variable.

Three things fall out of that one decision: tests build an app over an in-memory store
with no database; the Postgres fallback is a config change rather than a code change;
and `src/api/` contains no `import pg`.

Note the direction that gives the principle its name. `Repository` lives in
`src/repository/types.ts` and is defined in terms of _domain_ types, not database rows.
The abstraction belongs to the consumer, not the implementer — which is why the Postgres
implementation does the row-to-domain mapping, keeping column names out of the rest of
the codebase.

---

## The meta-point

Every principle here has a failure mode that looks like virtue:

| Principle | Over-applied, it becomes                                             |
| --------- | -------------------------------------------------------------------- |
| KISS      | Refusing structure the problem actually needs                        |
| YAGNI     | Skipping tests and layering, calling it pragmatism                   |
| DRY       | Abstracting coincidental similarity into indirection nobody can read |
| SRP       | Classes with one method and no cohesion                              |
| OCP       | Plugin architectures for things that never vary                      |
| ISP       | Six one-method interfaces where one cohesive interface was fine      |
| DIP       | Interfaces with exactly one implementation, forever                  |

**The judgement being assessed in an interview is not whether you can apply them. It is
whether you can say where you chose not to, and why.**

That is why this repo contains a deliberate DRY violation with a comment explaining it,
an honest admission that OCP is not satisfied, and an unfixed Liskov violation that is
documented rather than hidden. Naming a trade-off you made on purpose reads as
engineering judgement. Naming one you missed, and knowing how to fix it, reads better
than not having noticed.
