# Job API Assignment

A TypeScript/Express API for managing candidate profiles and job postings, with request
validation via Zod.

## Status

This README describes only what is currently implemented. As of now:

- Data models for `Candidate` and `Job` (Zod schemas + inferred types)
- `POST /candidates` — create a candidate profile
- `POST /jobs` — create a job posting
- `GET /candidates/:id/recommendations` — ranked job recommendations for a candidate
- `GET /home` — health check
- In-memory storage (no database)
- Docker / Docker Compose setup
- Prettier formatting

**Not yet implemented:** `GET`/list/update/delete for candidates and jobs, persistence
beyond process memory, and auth.

## Tech stack

- Node.js + TypeScript
- Express 5
- Zod 4 (validation and type inference)
- pnpm (package manager)
- Prettier (formatting)
- Docker / Docker Compose

## Project structure

```
src/
  enums/       TypeScript enums (e.g. SkillPriority)
  schemas/     Zod validation schemas
  types/       TypeScript types inferred from schemas
  store/       In-memory data stores
  routes/      Express route handlers
  index.ts     App entry point
```

## Running locally

Requires Node.js 22+ and pnpm.

```bash
pnpm install
pnpm dev        # start with hot reload (tsx watch), defaults to port 3000
```

Or build and run the compiled output:

```bash
pnpm build      # compiles TypeScript to dist/
pnpm start      # runs dist/index.js
```

The server reads `PORT` from the environment (defaults to `3000`).

### Formatting

```bash
pnpm format        # format all files
pnpm format:check  # check formatting without writing
```

## Running via Docker

```bash
docker compose up --build
```

This builds the image (multi-stage: install deps → compile TypeScript → run compiled
output on a slim Node runtime) and starts the API on `localhost:3000`.

```bash
docker compose down
```

## API

### `GET /home`

Health check.

```bash
curl localhost:3000/home
# {"status":"ok"}
```

### `POST /candidates`

Create a candidate profile.

```bash
curl -X POST localhost:3000/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ada Lovelace",
    "skills": ["TypeScript", "Math"],
    "yearsOfExperience": 5,
    "location": "Remote",
    "expectedSalary": 120000
  }'
```

Returns `201` with the created candidate (including a generated `id`), or `400` with
Zod field errors if the payload is invalid.

### `POST /jobs`

Create a job posting.

```bash
curl -X POST localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Backend Engineer",
    "requiredSkills": [
      { "skill": "Node.js", "priority": "must-have" },
      { "skill": "AWS", "priority": "nice-to-have" }
    ],
    "minYearsExperience": 3,
    "location": "Remote",
    "salaryRange": { "min": 90000, "max": 140000 },
    "remoteAllowed": true
  }'
```

Returns `201` with the created job (including a generated `id`), or `400` with Zod
field errors if the payload is invalid (e.g. `salaryRange.min > salaryRange.max`, or an
invalid `priority`).

### `GET /candidates/:id/recommendations`

Ranked list of jobs for a candidate, best match first.

Query params:

- `limit` (optional, positive integer) — return only the top N results.

```bash
curl "localhost:3000/candidates/<candidate-id>/recommendations?limit=5"
```

```json
[
  {
    "jobId": "023fbc7c-392d-4f65-bde7-dc00cc791da6",
    "title": "Backend Engineer",
    "score": 71,
    "breakdown": {
      "skills": { "score": 35, "max": 50 },
      "experience": { "score": 8, "max": 20 },
      "location": { "score": 15, "max": 15 },
      "salary": { "score": 13, "max": 15 }
    }
  }
]
```

Returns `404` if the candidate doesn't exist, or `400` if `limit` isn't a positive
integer.

## Scoring formula

Recommendations run in two stages: a hard filter, then point-based scoring.

**Hard filter — must-have skills.** A job that requires a must-have skill the candidate
doesn't have is excluded from the results entirely, no matter how well everything else
matches. This isn't a scoring penalty; the job never appears. Rationale: a "must-have"
is a hard requirement by definition — a high salary/experience/location fit doesn't
make a candidate qualified for a skill they don't have. Implementation:
`hasAllMustHaveSkills` in `src/scoring/job-match.ts`, applied as a `.filter()` before
`computeJobMatch` runs.

One consequence: since every job that survives the filter already has 100% must-have
coverage, the 35 must-have points described below are effectively a guaranteed baseline
for any job in the results — the visible variation in the skills score comes from
nice-to-have coverage (0–15 points on top of that baseline).

Each surviving candidate-job pair then gets a score out of 100, broken into four
weighted factors. Implementation: `src/scoring/job-match.ts`.

| Factor     | Max points | What it measures                                            |
| ---------- | ---------- | ----------------------------------------------------------- |
| Skills     | 50         | Coverage of the job's must-have and nice-to-have skills     |
| Experience | 20         | Candidate's years of experience vs. the job's minimum       |
| Location   | 15         | Whether the candidate can actually take the job             |
| Salary     | 15         | Whether the job's budget covers the candidate's expectation |

**Why these weights:**

- **Skills is the largest single factor (50/100)** because it's the most direct signal
  of whether a candidate can actually do the job — everything else (experience,
  location, salary) is a fit question, not a capability question.
  - Within skills, **must-have coverage (35 pts) outweighs nice-to-have coverage (15
    pts)**. Missing a "must-have" skill should hurt a lot more than missing an optional
    one; a job with no must-haves listed, or no nice-to-haves listed, awards full
    credit for that sub-category rather than penalizing the candidate for something
    the job never asked for.
- **Experience (20 pts) is penalized, not gated** — deliberately different treatment
  from must-have skills, which do exclude a job outright. The distinction: a missing
  must-have skill is usually a hard capability gap (you either know the tool or you
  don't), whereas `minYearsExperience` is a proxy the job poster picked, not an
  objective cutoff — a candidate at 4 of 5 required years is realistically employable
  and would never see the listing under a hard gate, which is a worse outcome than
  showing it lower-ranked. So experience is graded: meeting or exceeding the minimum is
  full credit, and below it, credit scales proportionally to how close the candidate is
  (half the required experience = half the points) rather than dropping to zero.
- **Location (15 pts) has three tiers, not two.** An exact match on `location` is the
  strongest signal (15 pts, full credit) — the candidate can take the job with zero
  friction. `remoteAllowed` on a non-matching location is real but weaker (10 pts): the
  job is still open to them, but "the employer will accept remote" isn't the same
  guarantee as "the candidate is already there" (time zone overlap, occasional on-site
  expectations, relocation preference, etc. are all still open questions). A mismatch
  with no remote option scores zero. Exact match wins even when a job is also
  `remoteAllowed`, since it's the strictly better outcome. There's no location/geo data
  in the model to support a finer-grained match (e.g. "same metro area"), so a fuzzier
  score there would just be noise. It's weighted below skills and experience because,
  in practice, remote-friendliness is common enough that this factor doesn't
  discriminate between candidates as often as the other two.
- **Salary (15 pts)** is asymmetric on purpose: if the candidate's expected salary is
  at or under the job's budget (`salaryRange.max`), that's full credit — including
  cases where the expectation is below the range minimum, since that's a bonus for the
  employer, not a mismatch. Above the max, credit decays linearly to zero once the
  candidate is asking for 50% more than the top of the range, so a candidate slightly
  over budget still scores reasonably (they might be negotiable) while someone wildly
  over budget scores near zero.

All four sub-scores are rounded to the nearest integer before summing, so the
`breakdown` values always add up to the displayed `score`.
