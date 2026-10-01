# Validation — 1.1.0 feature candidate

## Executed local checks

- **150 JavaScript tests** passed with zero failures and zero skips.
- **30 Python tooling/server tests** passed.
- Robustness-core tests cover deterministic consecutive seeds, uint32 wraparound, workload limits, synchronous/asynchronous equivalence, progress reporting and pathfinder total agreement.
- Robustness-report tests cover complete recomputation plus rejection of altered aggregates, altered per-seed results, changed starting seed, unsupported engine, fixed-order scenarios and mismatched current assignments.
- The actual robustness CLI successfully reproduced an exported browser report containing 5 seeds / 5,000 sampled orders.
- The exported browser report verified with engine version 1.1.0, A*, mean modeled reduction 15.4872%, median 15.5409%, minimum 15.1899%, maximum 15.6763%, and five positive seed outcomes.
- The historical standard 1,000-order seed-42 single-run result remains 44,194 current versus 37,266 suggested.

These checks are finite regression and consistency evidence, not proof for every warehouse configuration or evidence of real operational savings.

## Browser evidence and remaining browser gate

On the user's Mac, the v1.1 local server started successfully, the browser produced a five-seed robustness export, and that downloaded file was independently reproduced by the Node CLI.

The pasted evidence does not yet establish the separate stale-state observation after changing the robustness seed count from 5 to 6. Before publication, confirm that the old robustness metrics/table clear and robustness export becomes disabled.

The Python server tests independently exercise loopback HTTP behavior, allowlisted assets, Host/Origin checks, path traversal refusal, symlink refusal and non-writing POST behavior. They do not replace browser interaction checks.

## Interpretation boundary

The robustness feature measures sensitivity to several deterministic generated order samples. It is not a confidence interval, probability of future savings, calibrated demand forecast or production warehouse recommendation.

## Publication boundary

At this stage, local feature work does not establish remote feature-branch publication, pull-request creation, merge, v1.1.0 tag creation, GitHub release publication, post-merge CI success or post-merge Pages deployment. Those states require separate evidence against the exact commit involved.
