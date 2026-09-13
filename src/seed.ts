import { config } from "./config/env.js";
import { createCandidateSchema } from "./schemas/candidate.js";
import { createJobSchema } from "./schemas/job.js";
import { createStores } from "./store/index.js";

// Sample data chosen to exercise every scoring rule: missing must-haves, nice-to-have
// coverage, under-experience, all three location tiers, and salaries above and below
// expectations. Parsed through the same schemas as the API, so it can't store bad data.
const candidates = [
  {
    name: "Ada Lovelace",
    skills: ["TypeScript", "Node.js", "PostgreSQL", "AWS"],
    yearsOfExperience: 6,
    location: "Berlin",
    expectedSalary: 95000,
  },
  {
    name: "Grace Hopper",
    skills: ["Python", "Django", "PostgreSQL", "Docker"],
    yearsOfExperience: 9,
    location: "Remote",
    expectedSalary: 130000,
  },
  {
    name: "Alan Turing",
    skills: ["Go", "Kubernetes", "AWS", "Terraform"],
    yearsOfExperience: 4,
    location: "London",
    expectedSalary: 110000,
  },
  {
    name: "Katherine Johnson",
    skills: ["React", "TypeScript", "CSS", "Node.js"],
    yearsOfExperience: 2,
    location: "Berlin",
    expectedSalary: 70000,
  },
  {
    name: "Linus Torvalds",
    skills: ["C", "Linux", "Git", "Rust"],
    yearsOfExperience: 12,
    location: "Portland",
    expectedSalary: 180000,
  },
  {
    name: "Margaret Hamilton",
    skills: ["Java", "Spring", "Kafka", "AWS"],
    yearsOfExperience: 7,
    location: "London",
    expectedSalary: 120000,
  },
].map((candidate) => createCandidateSchema.parse(candidate));

const jobs = [
  {
    title: "Senior Backend Engineer",
    requiredSkills: [
      { skill: "Node.js", priority: "must-have" },
      { skill: "TypeScript", priority: "must-have" },
      { skill: "PostgreSQL", priority: "nice-to-have" },
      { skill: "AWS", priority: "nice-to-have" },
    ],
    minYearsExperience: 5,
    location: "Berlin",
    salaryRange: { min: 90000, max: 130000 },
    remoteAllowed: false,
  },
  {
    title: "Frontend Developer",
    requiredSkills: [
      { skill: "React", priority: "must-have" },
      { skill: "TypeScript", priority: "nice-to-have" },
      { skill: "CSS", priority: "nice-to-have" },
    ],
    minYearsExperience: 3,
    location: "Berlin",
    salaryRange: { min: 60000, max: 85000 },
    remoteAllowed: true,
  },
  {
    title: "Platform Engineer",
    requiredSkills: [
      { skill: "Kubernetes", priority: "must-have" },
      { skill: "Go", priority: "nice-to-have" },
      { skill: "Terraform", priority: "nice-to-have" },
      { skill: "AWS", priority: "nice-to-have" },
    ],
    minYearsExperience: 5,
    location: "London",
    salaryRange: { min: 100000, max: 150000 },
    remoteAllowed: true,
  },
  {
    title: "Python Developer",
    requiredSkills: [
      { skill: "Python", priority: "must-have" },
      { skill: "Django", priority: "nice-to-have" },
      { skill: "Docker", priority: "nice-to-have" },
    ],
    minYearsExperience: 4,
    location: "Amsterdam",
    salaryRange: { min: 90000, max: 125000 },
    remoteAllowed: true,
  },
  {
    title: "Java Backend Engineer",
    requiredSkills: [
      { skill: "Java", priority: "must-have" },
      { skill: "Spring", priority: "must-have" },
      { skill: "Kafka", priority: "nice-to-have" },
    ],
    minYearsExperience: 6,
    location: "London",
    salaryRange: { min: 110000, max: 140000 },
    remoteAllowed: false,
  },
  {
    title: "Systems Programmer",
    requiredSkills: [
      { skill: "C", priority: "must-have" },
      { skill: "Rust", priority: "must-have" },
      { skill: "Linux", priority: "nice-to-have" },
    ],
    minYearsExperience: 8,
    location: "Remote",
    salaryRange: { min: 150000, max: 200000 },
    remoteAllowed: true,
  },
].map((job) => createJobSchema.parse(job));

if (config.database.DB_DRIVER === "memory") {
  console.error("Seeding needs a persistent database. Set DB_DRIVER=postgres in .env.");
  process.exit(1);
}

const stores = await createStores(config.database);

try {
  const [existingCandidates, existingJobs] = await Promise.all([
    stores.candidateStore.list(),
    stores.jobStore.list(),
  ]);

  // Seeding twice would duplicate everything, since ids are generated on insert.
  if (existingCandidates.length > 0 || existingJobs.length > 0) {
    console.log(
      `Skipped: database already has ${existingCandidates.length} candidates and ${existingJobs.length} jobs.`,
    );
  } else {
    for (const candidate of candidates) await stores.candidateStore.create(candidate);
    for (const job of jobs) await stores.jobStore.create(job);
    console.log(`Seeded ${candidates.length} candidates and ${jobs.length} jobs.`);
  }
} finally {
  await stores.close();
}
