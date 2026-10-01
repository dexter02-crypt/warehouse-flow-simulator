# Validation — 1.1.0

## Executed local checks

- **150 JavaScript tests** passed with zero failures and zero skips.
- **30 Python tooling/server tests** passed.
- Robustness-core tests cover deterministic consecutive seeds, uint32 wraparound, workload limits, synchronous/asynchronous equivalence, progress reporting and pathfinder total agreement.
- Robustness-report tests cover complete recomputation plus rejection of altered aggregates, altered per-seed results, changed starting seed, unsupported engine, fixed-order scenarios and mismatched current assignments.
- The actual robustness CLI successfully reproduced an exported browser report containing 5 seeds / 5,000 sampled orders.
- The exported browser report verified with engine version 1.1.0, A*, mean modeled reduction 15.4872%, median 15.5409%, minimum 15.1899%, maximum 15.6763%, and five positive seed outcomes.
- The historical standard 1,000-order seed-42 single-run result remains 44,194 current versus 37,266 suggested.

These checks are finite regression and consistency evidence, not proof for every warehouse configuration or evidence of real operational savings.

## Browser evidence

On the user's Mac, the v1.1 local server started successfully, the browser produced a five-seed robustness export, and that downloaded file was independently reproduced by the Node CLI.

The browser stale-state check also passed: changing the robustness seed count after a completed run cleared the previous robustness metrics/table and disabled robustness export until the analysis was rerun.

The Python server tests independently exercise loopback HTTP behavior, allowlisted assets, Host/Origin checks, path traversal refusal, symlink refusal and non-writing POST behavior. They do not replace browser interaction checks.

## Interpretation boundary

The robustness feature measures sensitivity to several deterministic generated order samples. It is not a confidence interval, probability of future savings, calibrated demand forecast or production warehouse recommendation.

## Publication evidence

PR #1 integrated the robustness feature to `main` at commit `39d525ca8acd530e6845b89307097e82c1ab8c66`. Post-merge Core tests run `36856129750` and Pages deployment run `36856128722` both completed successfully on that exact implementation merge commit.

The v1.1.0 release tag must point to the final reviewed `main` commit after release-state documentation is integrated and Core tests plus Pages deployment succeed on that exact commit. Historical tags and releases remain immutable.
