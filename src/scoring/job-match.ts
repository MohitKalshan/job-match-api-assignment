import { SkillPriority } from "../enums/skill-priority.js";
import type { Candidate } from "../types/candidate.js";
import type { Job } from "../types/job.js";
import type { MatchResult, ScoreWeightOverrides, ScoreWeights } from "../types/match.js";

// Default point budget and sub-category ratios. Rationale documented in README.md ("Scoring formula").
const DEFAULT_WEIGHTS = {
  skills: 50,
  experience: 20,
  location: 15,
  salary: 15,
} as const;

// A caller-supplied `skills`/`location` total is split into sub-categories using these
// same proportions as the defaults (must-have:nice-to-have 7:3, exact:remote 3:2),
// so overriding the top-level weight doesn't require also specifying the split.
const SKILLS_MUST_HAVE_SHARE = 35 / 50;
const LOCATION_REMOTE_SHARE = 10 / 15;

export function resolveWeights(overrides: ScoreWeightOverrides = {}): ScoreWeights {
  const raw = {
    skills: overrides.skills ?? DEFAULT_WEIGHTS.skills,
    experience: overrides.experience ?? DEFAULT_WEIGHTS.experience,
    location: overrides.location ?? DEFAULT_WEIGHTS.location,
    salary: overrides.salary ?? DEFAULT_WEIGHTS.salary,
  };

  // Custom weights are relative: scale them so the four factors total 100, keeping the
  // score on the required 0–100 scale. The defaults already total 100, so they're unchanged.
  const total = raw.skills + raw.experience + raw.location + raw.salary;
  const scale = total > 0 ? 100 / total : 0;
  const skills = raw.skills * scale;
  const location = raw.location * scale;

  return {
    skills: {
      total: skills,
      mustHave: skills * SKILLS_MUST_HAVE_SHARE,
      niceToHave: skills * (1 - SKILLS_MUST_HAVE_SHARE),
    },
    experience: raw.experience * scale,
    location: {
      total: location,
      remoteAllowed: location * LOCATION_REMOTE_SHARE,
    },
    salary: raw.salary * scale,
  };
}

export interface WeightQueryParams {
  weightSkills?: number;
  weightExperience?: number;
  weightLocation?: number;
  weightSalary?: number;
}

export function weightOverridesFromQuery(query: WeightQueryParams): ScoreWeightOverrides {
  return {
    skills: query.weightSkills,
    experience: query.weightExperience,
    location: query.weightLocation,
    salary: query.weightSalary,
  };
}

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

function toSkillSet(skills: string[]): Set<string> {
  return new Set(skills.map(normalizeSkill));
}

// Hard filter, applied before scoring: a missing must-have disqualifies the job entirely.
// Not weight-configurable — must-have is a hard requirement regardless of point budget.
export function hasAllMustHaveSkills(candidate: Candidate, job: Job): boolean {
  const candidateSkills = toSkillSet(candidate.skills);
  return job.requiredSkills
    .filter((s) => s.priority === SkillPriority.MustHave)
    .every((s) => candidateSkills.has(normalizeSkill(s.skill)));
}

// Only called for jobs that already passed hasAllMustHaveSkills, so mustHaveScore is always full here.
function scoreSkills(candidate: Candidate, job: Job, weights: ScoreWeights): number {
  const candidateSkills = toSkillSet(candidate.skills);
  const mustHaves = job.requiredSkills.filter((s) => s.priority === SkillPriority.MustHave);
  const niceToHaves = job.requiredSkills.filter((s) => s.priority === SkillPriority.NiceToHave);

  const mustHaveScore =
    mustHaves.length === 0
      ? weights.skills.mustHave
      : (mustHaves.filter((s) => candidateSkills.has(normalizeSkill(s.skill))).length /
          mustHaves.length) *
        weights.skills.mustHave;

  const niceToHaveScore =
    niceToHaves.length === 0
      ? weights.skills.niceToHave
      : (niceToHaves.filter((s) => candidateSkills.has(normalizeSkill(s.skill))).length /
          niceToHaves.length) *
        weights.skills.niceToHave;

  return mustHaveScore + niceToHaveScore;
}

// Below the minimum, credit scales linearly rather than dropping straight to zero.
function scoreExperience(candidate: Candidate, job: Job, weights: ScoreWeights): number {
  if (job.minYearsExperience <= 0 || candidate.yearsOfExperience >= job.minYearsExperience) {
    return weights.experience;
  }
  return (candidate.yearsOfExperience / job.minYearsExperience) * weights.experience;
}

// Three tiers: exact location match ranks above remote-allowed, which ranks above a mismatch.
function scoreLocation(candidate: Candidate, job: Job, weights: ScoreWeights): number {
  const isExactMatch = normalizeSkill(candidate.location) === normalizeSkill(job.location);
  if (isExactMatch) {
    return weights.location.total;
  }
  if (job.remoteAllowed) {
    return weights.location.remoteAllowed;
  }
  return 0;
}

// Ramps from 0 (max at or below expectation) to full credit once max is 20%+ above expectation.
function scoreSalary(candidate: Candidate, job: Job, weights: ScoreWeights): number {
  const { expectedSalary } = candidate;
  if (expectedSalary <= 0) {
    return weights.salary;
  }

  const COMFORTABLE_MARGIN = 0.2;
  const marginRatio = (job.salaryRange.max - expectedSalary) / expectedSalary;
  const normalized = Math.min(Math.max(marginRatio, 0), COMFORTABLE_MARGIN) / COMFORTABLE_MARGIN;
  return weights.salary * normalized;
}

export function computeJobMatch(
  candidate: Candidate,
  job: Job,
  weights: ScoreWeights = resolveWeights(),
): MatchResult {
  const skills = Math.round(scoreSkills(candidate, job, weights));
  const experience = Math.round(scoreExperience(candidate, job, weights));
  const location = Math.round(scoreLocation(candidate, job, weights));
  const salary = Math.round(scoreSalary(candidate, job, weights));

  return {
    // Rounding each factor separately can add up to just over 100 with unusual custom
    // weights, so cap it. With the default weights this never triggers.
    score: Math.min(skills + experience + location + salary, 100),
    breakdown: {
      skills: { score: skills, max: Math.round(weights.skills.total) },
      experience: { score: experience, max: Math.round(weights.experience) },
      location: { score: location, max: Math.round(weights.location.total) },
      salary: { score: salary, max: Math.round(weights.salary) },
    },
  };
}

// Shared by both recommendation directions: apply the must-have hard filter, score, sort best-first.
export function rankJobsForCandidate(
  candidate: Candidate,
  jobs: Job[],
  weights: ScoreWeights = resolveWeights(),
): Array<{ job: Job } & MatchResult> {
  return jobs
    .filter((job) => hasAllMustHaveSkills(candidate, job))
    .map((job) => ({ job, ...computeJobMatch(candidate, job, weights) }))
    .sort((a, b) => b.score - a.score);
}

export function rankCandidatesForJob(
  job: Job,
  candidates: Candidate[],
  weights: ScoreWeights = resolveWeights(),
): Array<{ candidate: Candidate } & MatchResult> {
  return candidates
    .filter((candidate) => hasAllMustHaveSkills(candidate, job))
    .map((candidate) => ({ candidate, ...computeJobMatch(candidate, job, weights) }))
    .sort((a, b) => b.score - a.score);
}
