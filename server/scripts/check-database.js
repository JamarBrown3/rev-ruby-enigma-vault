import { performance } from "node:perf_hooks";
import {
  connectDatabase,
  pingDatabase,
  disconnectDatabase,
  explainDatabaseError,
} from "../config/database.js";

const smoke = process.argv.includes("--smoke");

try {
  const started = performance.now();
  await connectDatabase();
  console.log(`Connection established in ${Math.round(performance.now() - started)} ms.`);

  // Small read-only check, NOT an Atlas load/stress test. No records created.
  const rounds = smoke ? 4 : 1;
  const concurrency = smoke ? 3 : 1;
  const timings = [];
  for (let round = 0; round < rounds; round += 1) {
    const results = await Promise.all(Array.from({ length: concurrency }, async () => {
      const start = performance.now();
      await pingDatabase();
      return performance.now() - start;
    }));
    timings.push(...results);
  }
  console.log(`PASS: ${timings.length}/${timings.length} read-only pings; maximum concurrency ${concurrency}.`);
  console.log(`Ping latency: average ${Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)} ms; maximum ${Math.round(Math.max(...timings))} ms.`);
  console.log("No collections or documents were created, changed, or deleted.");
} catch (error) {
  console.error("FAIL:", explainDatabaseError(error));
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
