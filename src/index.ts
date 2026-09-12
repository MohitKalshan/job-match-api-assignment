import { z } from "zod";
import { createApp } from "./app.js";
import { createInMemoryCandidateStore } from "./store/candidates.js";
import { createInMemoryJobStore } from "./store/jobs.js";

// The composition root: the only file that picks concrete implementations.
const app = createApp({
  candidateStore: createInMemoryCandidateStore(),
  jobStore: createInMemoryJobStore(),
});

const port = z.coerce.number().default(3000).parse(process.env.PORT);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
