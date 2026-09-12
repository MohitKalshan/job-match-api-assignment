import { SkillPriority } from "../enums/skill-priority.js";
import type { Candidate } from "../types/candidate.js";
import type { Job } from "../types/job.js";
import type { MatchResult } from "../types/match.js";

// Weight rationale documented in README.md ("Scoring formula").
export const SCORE_WEIGHTS = {
  skills: { total: 50, mustHave: 35, niceToHave: 15 },
  experience: 20,
  location: { total: 15, remoteAllowed: 10 },
  salary: 15,
} as const;

function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

function toSkillSet(skills: string[]): Set<string> {
  return new Set(skills.map(normalizeSkill));
}

// Hard filter, applied before scoring: a missing must-have disqualifies the job entirely.
export function hasAllMustHaveSkills(candidate: Candidate, job: Job): boolean {
  const candidateSkills = toSkillSet(candidate.skills);
  return job.requiredSkills
    .filter((s) => s.priority === SkillPriority.MustHave)
    .every((s) => candidateSkills.has(normalizeSkill(s.skill)));
}

// Only called for jobs that already passed hasAllMustHaveSkills, so mustHaveScore is always full here.
function scoreSkills(candidate: Candidate, job: Job): number {
  const candidateSkills = toSkillSet(candidate.skills);
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

// Three tiers: exact location match ranks above remote-allowed, which ranks above a mismatch.
function scoreLocation(candidate: Candidate, job: Job): number {
  const isExactMatch = normalizeSkill(candidate.location) === normalizeSkill(job.location);
  if (isExactMatch) {
    return SCORE_WEIGHTS.location.total;
  }
  if (job.remoteAllowed) {
    return SCORE_WEIGHTS.location.remoteAllowed;
  }
  return 0;
}

// Ramps from 0 (max at or below expectation) to full credit once max is 20%+ above expectation.
function scoreSalary(candidate: Candidate, job: Job): number {
  const { expectedSalary } = candidate;
  if (expectedSalary <= 0) {
    return SCORE_WEIGHTS.salary;
  }

  const COMFORTABLE_MARGIN = 0.2;
  const marginRatio = (job.salaryRange.max - expectedSalary) / expectedSalary;
  const normalized = Math.min(Math.max(marginRatio, 0), COMFORTABLE_MARGIN) / COMFORTABLE_MARGIN;
  return SCORE_WEIGHTS.salary * normalized;
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
      location: { score: location, max: SCORE_WEIGHTS.location.total },
      salary: { score: salary, max: SCORE_WEIGHTS.salary },
    },
  };
}
