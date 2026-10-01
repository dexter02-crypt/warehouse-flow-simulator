/** Recompute a downloaded report locally; no requests, writes or trusted-result shortcuts. */
import fs from 'node:fs';
import { reproduceReport } from '../src/io/report.js';
import { LIMITS } from '../src/common/validation.js';
try {
  if (process.argv.length !== 3) throw new Error('Usage: node tools/reproduce-report.mjs path/to/report.json');
  const path = process.argv[2], stat = fs.lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > LIMITS.reportBytes) throw new Error('Choose a regular report file of at most 16 MiB.');
  console.log(JSON.stringify(reproduceReport(fs.readFileSync(path, 'utf8')), null, 2));
} catch (error) { console.error(`REPORT CHECK FAILED: ${error.message}`); process.exitCode = 1; }
