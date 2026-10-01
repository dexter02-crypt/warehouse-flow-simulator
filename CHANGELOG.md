# Changelog

## 1.1.0 — 2026-10-01

- Added bounded deterministic multi-seed robustness analysis for generated-order scenarios.
- Added 2–20 consecutive-seed runs with a maximum of 20,000 sampled orders across the analysis.
- Added mean, median, minimum and maximum modeled reduction plus positive/zero/negative seed outcomes and per-seed totals.
- Added reproducible robustness reports and `tools/reproduce-robustness.mjs`; changed settings or results fail recomputation.
- Added browser controls, results, per-seed table and robustness JSON export.
- Preserved the v1.0.1 single-run report contract and the historical seed-42 reference.

## 1.0.1 — 2026-10-01

- Replaced the false-success publisher test invocation with explicit test filenames, no shell and failure propagation; retired initial repository creation.
- Validated complete current/suggested allocations for single occupancy, compatibility and depot reachability.
- Added a feasibility reassignment fallback when greedy slotting blocks an otherwise valid allocation.
- Rejected coerced/null/non-finite numeric fields, sparse arrays and invalid seeds; added work and output-size bounds.
- Completed distinct order lines under skewed demand instead of silently truncating; honored embedded orders and genuine seed 0. Standard seed-42 output retained.
- Made cached route results immutable and checked that injected oracles match the grid and algorithm.
- Invalidated stale UI results/exports and displayed load/input/computation errors; rendered identifiers as literal text.
- Added self-contained report capture and local recomputation checks.
- Restricted the development server to approved runtime assets and excluded private paths/symlinks.
- Retained all 79 original test methods unchanged and added focused application, tooling and server regressions.
- Published v1.0.1 without moving the v1.0.0 tag; retained the historical screenshot and prior release.

## 1.0.0 — 2026-10-01

Initial integrated release: warehouse/grid validation, ABC/XYZ, constrained slotting, A*/Dijkstra/bidirectional routing, seeded orders, nearest-next picking, before/after metrics, route preview, JSON export and regression tests.
