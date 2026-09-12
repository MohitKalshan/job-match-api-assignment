# Job API Assignment

A TypeScript/Express API for managing candidate profiles and job postings, with request
validation via Zod.

## Status

This README describes only what is currently implemented. As of now:

- Data models for `Candidate` and `Job` (Zod schemas + inferred types)
- `POST /candidates` — create a candidate profile
- `POST /jobs` — create a job posting
- `GET /home` — health check
- In-memory storage (no database)
- Docker / Docker Compose setup
- Prettier formatting

**Not yet implemented:** candidate-job matching/scoring. There is no scoring formula in the
codebase yet, so it isn't documented here — it will be added once that feature is built.

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