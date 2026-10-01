# Reliability review — 2026-10-01

Subject: `dexter02-crypt/warehouse-flow-simulator` at `7bc775a3ec5dfe5561ed65f05e18d5958d166bbf`. The original 79 tests passed before the review. All findings below were reproduced on that source rather than inferred from a test count.

| ID | Finding and reproduction | Candidate action |
|---|---|---|
| R01 | `publish.py` passed a list to `subprocess.run(..., shell=True)`. An intentionally failing Node fixture yielded exit 0 without test output; correct direct argument execution yielded exit 1. The user's earlier REPL appearance is consistent with this. | Real sorted test file paths, `shell=False`, closed stdin, checked exit status. Initial-creation mode retired rather than adding another unsafe publication path. |
| R02 | Run the default case, set order count to zero, run again: an unhandled `order-config` exception leaves the prior mean and export available. The exported old JSON remained byte-equivalent after the failed run. | Explicit error state, clear old metrics, disable export on edit/failure, normal recovery after valid rerun. |
| R03 | Export contains a scenario name and result paths but not the warehouse/SKU model, exact orders or allocations needed to independently recreate the computation. | Self-contained report plus recomputation CLI. Inconsistent stored results fail; signatures/authenticity are not claimed. |
| R04 | Duplicate current slot occupancy, incompatible current zones/capacities and unreachable occupied locations pass scenario validation; an invalid supplied allocation also reaches picking. | Complete allocation validation shared by scenario and planning boundaries. |
| R05 | Two SKUs/two slots: a frequent small SKU greedily takes the only large slot, then the large SKU fails, although swapping those choices is feasible. | Augmenting-path feasibility fallback. No promise of globally best travel cost. |
| R06 | Null demand coerces to zero; NaN seed is accepted; 1e308 demand creates non-finite classification; sparse grids and invalid singleton paths are accepted. | Explicit types, dense arrays, finite bounds and index checks. |
| R07 | With heavily skewed demand, retry exhaustion produces only one-line orders when larger distinct orders were drawn. | Completion from remaining candidates or explicit work-limit failure, with versioned generator behavior. |
| R08 | Caller's edit of a cached distance object changes later cached cost to -999. | Frozen cached values and grid/algorithm-bound oracle identity. |
| R09 | A local scenario fixture containing markup in a SKU identifier inserts an element and executes a harmless marker in the browser harness. No live-site exploit was attempted. | Literal DOM/SVG text rendering; fixture remains visible text with no injected element or marker execution. |
| R10 | The local source server responds 200 to `/.git/config` in a synthetic clone. The original handler also follows filesystem symlinks. | Approved asset paths, no listings/hidden files/symlinks, loopback Host/Origin checks. Actual HTTP regression tests. |

The old source inventory no longer matched the README after the screenshot commit and was not used by the publisher. The maintenance inventory is rebuilt and checked; unlisted executable test/source files are refused in the normal identity-checked path.

## What remains outside closure

This is not a production security audit. Real warehouse savings, globally optimal slotting/pick sequencing, live-site browser behavior, the user's Mac and future CI/deployment are not certified. Browser tests in the review environment used native DOM/ES modules in an in-memory Chromium harness with only the scenario fetch mocked; direct browser-to-localhost navigation was blocked by environment policy. Python HTTP requests were tested separately against the actual server.

Malformed duplicate JSON object keys, a hostile local interpreter/toolchain, local filesystem races and authenticated provenance of reports are not solved by this patch. Work caps can reject large/pathological scenarios. The UI remains a fixed scenario-file application, not a general upload/editor system.

## Retained sample

The standard seed-42, 1,000-order, five-line A* sample remains 44,194 → 37,266 total cost; means 44.194 → 37.266; 786 improved / 134 unchanged / 80 worsened. This verifies regression stability for that input, not universal improvement.

## Primary platform references

- Python subprocess argument and shell semantics: https://docs.python.org/3/library/subprocess.html
- Node.js test runner and CLI: https://nodejs.org/docs/latest-v22.x/api/test.html
- Python HTTP server security considerations: https://docs.python.org/3/library/http.server.html

Findings are based on the project's actual source and local executions; these references explain platform behavior rather than prove the project correct.
