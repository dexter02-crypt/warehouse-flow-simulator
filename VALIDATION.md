# Candidate validation

Warehouse Flow Simulator v1.1.0 feature candidate, based on published v1.0.1 commit `909b5a7d4eb510e805074cf6f64f6bf9d211896e`.

Current local evidence includes 150 JavaScript tests and 30 Python tooling/server tests with no failures. The browser robustness flow exported a five-seed report covering 5,000 sampled orders, and `tools/reproduce-robustness.mjs` independently recomputed it with `"verified": true`.

The v1.0.1 single-run report contract remains supported. The new robustness report uses engine version 1.1.0.

Run `python3 -B tools/check.py` for the strict integrity-bound local check after rebuilding `INTEGRITY.json`.

A passing local check does not establish remote branch, PR, merge, tag, release, post-merge CI or Pages success.
