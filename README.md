# Job API Assignment

A TypeScript/Express API for managing candidate profiles and job postings, with request
validation via Zod.

## Status

This README describes only what is currently implemented. As of now:

- Data models for `Candidate` and `Job` (Zod schemas + inferred types)
- `POST /candidates` — create a candidate profile
- `POST /jobs` — create a job posting
- `GET /candidates/:id/recommendations` — ranked job recommendations for a candidate
- `GET /jobs/:id/recommendations` — ranked best-fit candidates for a job (reverse view)
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

### `GET /jobs/:id/recommendations`

The reverse view: ranked list of best-fit candidates for a job, best match first. Uses
the same scoring (including the must-have hard filter) and query params as the
candidate-facing endpoint above — just with the roles swapped.

Query params:

- `limit` (optional, positive integer) — return only the top N results.

```bash
curl "localhost:3000/jobs/<job-id>/recommendations?limit=5"
```

```json
[
  {
    "candidateId": "cebb1f5d-66f8-4b1d-9018-83d171536a9a",
    "name": "Ada Lovelace",
    "score": 100,
    "breakdown": {
      "skills": { "score": 50, "max": 50 },
      "experience": { "score": 20, "max": 20 },
      "location": { "score": 15, "max": 15 },
      "salary": { "score": 15, "max": 15 }
    }
  }
]
```

Returns `404` if the job doesn't exist, or `400` if `limit` isn't a positive integer.

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

The 50/20/15/15 split isn't derived from any formula — it's a judgment call about
which factors are _capability_ questions versus _fit_ questions, ranked by how much
each one should move the needle:

1. **Skills (50) outranks everything else combined** because it answers "can this
   candidate do the job at all," which is qualitatively different from the other three
   — those are all "would this particular arrangement work," not "is this person
   capable." A candidate who's a perfect salary/location/experience match but is
   missing the core skills isn't a good recommendation; the reverse (strong skills,
   imperfect logistics) usually still is.
2. **Experience (20) outranks location and salary (15 each)** because it's the closest
   thing to a second capability signal — "has this person done enough of this work" —
   even though (per the reasoning below) it's graded rather than gated. It still isn't
   weighted as heavily as skills because `minYearsExperience` is a blunter proxy: two
   candidates who both clear the bar aren't meaningfully differentiated by _how much_
   they clear it, whereas two candidates' skill sets can differ enormously.
3. **Location and salary are tied at 15** because they're both pure logistics/fit
   questions rather than capability questions, and neither is obviously more
   consequential than the other in general — which one matters more in practice
   depends heavily on the specific candidate and job, so there's no principled reason
   to rank one above the other by default.

Per-factor detail:

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
- **Salary (15 pts) is a continuous ramp based on headroom, not a flat pass/fail at
  `salaryRange.max`.** The signal that matters is how much cushion the job's budget
  has above what the candidate is asking for:
  - If `max` is at or below the candidate's `expectedSalary` — the job's ceiling
    can't even meet the ask — the score is 0. This includes the exact-breakeven case
    (`max == expectedSalary`): meeting the number exactly leaves no room for
    negotiation, leveling, or a raise, so it scores the same as falling short rather
    than getting a pass purely for clearing the bar.
  - Once `max` exceeds `expectedSalary`, the score ramps up linearly with the size of
    that margin (as a percentage of `expectedSalary`), reaching full credit once `max`
    is **20% or more above** the expectation — a threshold picked because a
    20%+ cushion is a "comfortably above" budget by most hiring intuitions, not a
    precisely derived number. A 10% margin lands roughly at half credit.
  - `salaryRange.min` isn't part of the formula: a candidate asking for less than the
    range minimum is still judged purely on how far `max` clears their ask, since the
    employer's floor doesn't constrain whether they can afford the candidate.

All four sub-scores are rounded to the nearest integer before summing, so the
`breakdown` values always add up to the displayed `score`.
