# Release validation

Warehouse Flow Simulator v1.1.0 builds on published v1.0.1 commit `909b5a7d4eb510e805074cf6f64f6bf9d211896e`.

The robustness implementation was integrated through PR #1 at main commit `39d525ca8acd530e6845b89307097e82c1ab8c66`. Post-merge Core tests run `36856129750` and Pages deployment run `36856128722` both succeeded on that exact implementation merge commit.

Local evidence includes 150 JavaScript tests and 30 Python tooling/server tests with no failures. The Mac browser robustness flow exported a five-seed report covering 5,000 sampled orders, and `tools/reproduce-robustness.mjs` independently recomputed it with `"verified": true`. The browser stale-state check also passed.

The v1.0.1 single-run report contract remains supported, including the historical seed-42 result of 44,194 current versus 37,266 suggested. The new robustness report uses engine version 1.1.0.

Run `python3 -B tools/check.py` for the strict integrity-bound local check.

Release publication must use the final reviewed main commit only after Core tests and Pages deployment succeed on that exact commit. These checks establish finite regression, integration and publication evidence; they do not prove real-world warehouse savings.
