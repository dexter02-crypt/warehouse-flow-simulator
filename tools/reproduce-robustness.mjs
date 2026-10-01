/** Recompute a downloaded robustness report locally; no requests, writes or trusted-result shortcuts. */
import fs from 'node:fs';
import { reproduceRobustnessReport } from '../src/io/robustness-report.js';
import { LIMITS } from '../src/common/validation.js';

try {
  if (process.argv.length !== 3) {
    throw new Error(
      'Usage: node tools/reproduce-robustness.mjs path/to/robustness-report.json'
    );
  }

  const path = process.argv[2];
  const stat = fs.lstatSync(path);

  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size > LIMITS.reportBytes
  ) {
    throw new Error(
      'Choose a regular robustness report file of at most 16 MiB.'
    );
  }

  const report = fs.readFileSync(path, 'utf8');

  console.log(
    JSON.stringify(
      reproduceRobustnessReport(report),
      null,
      2
    )
  );
} catch (error) {
  console.error(`ROBUSTNESS CHECK FAILED: ${error.message}`);
  process.exitCode = 1;
}
