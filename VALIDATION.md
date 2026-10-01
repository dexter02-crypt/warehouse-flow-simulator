# Candidate validation

Warehouse Flow Simulator 1.0.1 maintenance candidate, based on public commit `7bc775a3ec5dfe5561ed65f05e18d5958d166bbf`.

128 JavaScript application tests and 30 Python tooling/server tests passed with no skips in the review environment. All 79 original application methods were retained unchanged. The separate repair delivery has its own helper tests and browser-harness evidence.

Run `python3 -B tools/check.py` for the full local check. `npm test` runs only JavaScript tests.

See [the detailed boundaries](docs/VALIDATION.md) and [reliability findings](docs/RELIABILITY.md). The repair's remote CI, real Mac browser and updated Pages deployment remain unverified until the candidate is applied and tested there. No release/tag or repository write was performed by the review.
