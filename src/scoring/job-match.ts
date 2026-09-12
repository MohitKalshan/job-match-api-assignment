import { SkillPriority } from "../enums/skill-priority.js";
import type { Candidate } from "../types/candidate.js";
import type { Job } from "../types/job.js";
import type { MatchResult } from "../types/match.js";

// Weight rationale documented in README.md ("Scoring formula").
export const SCORE_WEIGHTS = {
  skills: { total: 50, mustHave: 35, niceToHave: 15 },
  experience: 20,
  location: 15,
  salary: 15,
} as const;

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

// A category with no required skills awards full credit for that category rather than penalizing.
function scoreSkills(candidate: Candidate, job: Job): number {
  const candidateSkills = new Set(candidate.skills.map(normalizeSkill));
  const mustHaves = job.requiredSkills.filter((s) => s.priority === SkillPriority.MustHave);
  const niceToHaves = job.requiredSkills.filter((s) => s.priority === SkillPriority.NiceToHave);

  const mustHaveScore =
    mustHaves.length === 0
      ? SCORE_WEIGHTS.skills.mustHave
      : (mustHaves.filter((s) => candidateSkills.has(normalizeSkill(s.skill))).length /
          mustHaves.length) *
        SCORE_WEIGHTS.skills.mustHave;

  const niceToHaveScore =
    niceToHaves.length === 0
      ? SCORE_WEIGHTS.skills.niceToHave
      : (niceToHaves.filter((s) => candidateSkills.has(normalizeSkill(s.skill))).length /
          niceToHaves.length) *
        SCORE_WEIGHTS.skills.niceToHave;

  return mustHaveScore + niceToHaveScore;
}

// Below the minimum, credit scales linearly rather than dropping straight to zero.
function scoreExperience(candidate: Candidate, job: Job): number {
  if (job.minYearsExperience <= 0 || candidate.yearsOfExperience >= job.minYearsExperience) {
    return SCORE_WEIGHTS.experience;
  }
  return (candidate.yearsOfExperience / job.minYearsExperience) * SCORE_WEIGHTS.experience;
}

// Binary: remote jobs skip location entirely; otherwise it's an exact string match.
function scoreLocation(candidate: Candidate, job: Job): number {
  if (job.remoteAllowed) {
    return SCORE_WEIGHTS.location;
  }
  return normalizeSkill(candidate.location) === normalizeSkill(job.location)
    ? SCORE_WEIGHTS.location
    : 0;
}

// Full credit at or under the range max; decays linearly to zero 50% over max.
function scoreSalary(candidate: Candidate, job: Job): number {
  const { max } = job.salaryRange;
  if (candidate.expectedSalary <= max) {
    return SCORE_WEIGHTS.salary;
  }
  const overBudgetRatio = (candidate.expectedSalary - max) / max;
  const OVER_BUDGET_TOLERANCE = 0.5;
  return SCORE_WEIGHTS.salary * Math.max(0, 1 - overBudgetRatio / OVER_BUDGET_TOLERANCE);
}

export function computeJobMatch(candidate: Candidate, job: Job): MatchResult {
  const skills = Math.round(scoreSkills(candidate, job));
  const experience = Math.round(scoreExperience(candidate, job));
  const location = Math.round(scoreLocation(candidate, job));
  const salary = Math.round(scoreSalary(candidate, job));

  return {
    score: skills + experience + location + salary,
    breakdown: {
      skills: { score: skills, max: SCORE_WEIGHTS.skills.total },
      experience: { score: experience, max: SCORE_WEIGHTS.experience },
      location: { score: location, max: SCORE_WEIGHTS.location },
      salary: { score: salary, max: SCORE_WEIGHTS.salary },
    },
  };
}
