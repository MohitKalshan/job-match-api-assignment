import assert from "assert/strict";
import { describe, it } from "node:test";
import { SkillPriority } from "../../src/enums/skill-priority.js";
import {
  computeJobMatch,
  rankJobsForCandidate,
  resolveWeights,
} from "../../src/scoring/job-match.js";
import type { Candidate } from "../../src/types/candidate.js";
import type { Job } from "../../src/types/job.js";

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  id: "c1",
  name: "Ada",
  skills: ["Node.js", "AWS"],
  yearsOfExperience: 5,
  location: "Berlin",
  expectedSalary: 100_000,
  ...overrides,
});

const job = (overrides: Partial<Job> = {}): Job => ({
  id: "j1",
  title: "Backend Engineer",
  requiredSkills: [{ skill: "Node.js", priority: SkillPriority.MustHave }],
  minYearsExperience: 3,
  location: "Berlin",
  salaryRange: { min: 90_000, max: 130_000 },
  remoteAllowed: false,
  ...overrides,
});

describe("must-have skills", () => {
  it("excludes a job requiring a must-have skill the candidate lacks", () => {
    const needsRust = job({
      requiredSkills: [{ skill: "Rust", priority: SkillPriority.MustHave }],
    });
    assert.equal(rankJobsForCandidate(candidate(), [needsRust]).length, 0);
  });

  it("excludes it even when everything else is a perfect match", () => {
    const needsRust = job({
      requiredSkills: [{ skill: "Rust", priority: SkillPriority.MustHave }],
      minYearsExperience: 0,
      salaryRange: { min: 0, max: 500_000 },
    });
    assert.equal(rankJobsForCandidate(candidate(), [needsRust]).length, 0);
  });

  it("matches skills case-insensitively", () => {
    const lowercase = job({
      requiredSkills: [{ skill: "node.js", priority: SkillPriority.MustHave }],
    });
    assert.equal(rankJobsForCandidate(candidate(), [lowercase]).length, 1);
  });
});

describe("nice-to-have skills", () => {
  const withNiceToHave = job({
    requiredSkills: [
      { skill: "Node.js", priority: SkillPriority.MustHave },
      { skill: "Kubernetes", priority: SkillPriority.NiceToHave },
    ],
  });

  it("does not exclude a candidate who lacks them", () => {
    assert.equal(rankJobsForCandidate(candidate(), [withNiceToHave]).length, 1);
  });

  it("boosts the score when the candidate has them", () => {
    const without = computeJobMatch(candidate(), withNiceToHave);
    const withIt = computeJobMatch(
      candidate({ skills: ["Node.js", "Kubernetes"] }),
      withNiceToHave,
    );
    assert.ok(withIt.score > without.score);
  });
});

describe("experience", () => {
  const needsTen = job({ minYearsExperience: 10 });

  it("keeps an under-experienced candidate in the results", () => {
    assert.equal(rankJobsForCandidate(candidate({ yearsOfExperience: 2 }), [needsTen]).length, 1);
  });

  it("scores them lower, in proportion to how close they are", () => {
    const half = computeJobMatch(candidate({ yearsOfExperience: 5 }), needsTen);
    const full = computeJobMatch(candidate({ yearsOfExperience: 10 }), needsTen);
    assert.equal(half.breakdown.experience.score, 10);
    assert.equal(full.breakdown.experience.score, 20);
  });
});

describe("location", () => {
  it("ranks exact match above remote-allowed above mismatch", () => {
    const exact = computeJobMatch(candidate(), job({ location: "Berlin" }));
    const remote = computeJobMatch(candidate(), job({ location: "Tokyo", remoteAllowed: true }));
    const mismatch = computeJobMatch(candidate(), job({ location: "Tokyo", remoteAllowed: false }));

    assert.equal(exact.breakdown.location.score, 15);
    assert.equal(remote.breakdown.location.score, 10);
    assert.equal(mismatch.breakdown.location.score, 0);
  });
});

describe("salary", () => {
  const withMax = (max: number) => job({ salaryRange: { min: 0, max } });

  it("scores zero when the job's max is below the expectation", () => {
    assert.equal(computeJobMatch(candidate(), withMax(80_000)).breakdown.salary.score, 0);
  });

  it("scores zero when there is no headroom above the expectation", () => {
    assert.equal(computeJobMatch(candidate(), withMax(100_000)).breakdown.salary.score, 0);
  });

  it("scores full points when the max is comfortably above the expectation", () => {
    assert.equal(computeJobMatch(candidate(), withMax(130_000)).breakdown.salary.score, 15);
  });
});

describe("overall score", () => {
  it("gives a perfect match 100 with a breakdown that sums to it", () => {
    const { score, breakdown } = computeJobMatch(candidate(), job());
    const sum = Object.values(breakdown).reduce((total, factor) => total + factor.score, 0);
    assert.equal(score, 100);
    assert.equal(sum, score);
  });

  it("ranks jobs best match first", () => {
    const strong = job({ id: "strong" });
    const weak = job({ id: "weak", location: "Tokyo", salaryRange: { min: 0, max: 90_000 } });
    const ranked = rankJobsForCandidate(candidate(), [weak, strong]);
    assert.deepEqual(
      ranked.map((r) => r.job.id),
      ["strong", "weak"],
    );
  });

  it("stays within 0–100 with custom weights", () => {
    const weights = [
      resolveWeights({ skills: 1000 }),
      resolveWeights({ skills: 33.5, experience: 33.5, location: 16.5, salary: 16.5 }),
      resolveWeights({ skills: 0, experience: 0, location: 0, salary: 0 }),
    ];
    for (const w of weights) {
      const { score } = computeJobMatch(candidate(), job(), w);
      assert.ok(score >= 0 && score <= 100, `score ${score} out of range`);
    }
  });
});
