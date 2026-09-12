import express from "express";
import { z } from "zod";

const app = express();
app.use(express.json());

const port = z.coerce.number().default(3000).parse(process.env.PORT);

app.get("/home", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
