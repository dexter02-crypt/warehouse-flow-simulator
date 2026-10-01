# Validation — 1.0.1 maintenance candidate

## Executed checks

- **128 Node test methods**, including the exact 79 original tests and 49 new reliability methods. Zero skipped.
- **30 Python tooling/server tests**. These include deliberately failing/passing Node subprocess fixtures and real loopback HTTP requests. Zero skipped.
- Routing tests include 7,488 comparisons on every 2×2 grid over {wall,1,3,6} and every walkable endpoint pair, plus 100 seeded 3×3 grids, against an independent Floyd–Warshall implementation.
- Assignment tests compare 256 small constrained cases against independent exhaustive permutation feasibility.
- The standard 1,000-order case was recomputed, exported from the actual browser application, and reproduced by the Node report CLI.
- The separate delivery review used 38 in-memory Chromium assertions: normal/invalid input, stale-export prevention, error recovery, literal labels, three pathfinders, seed 0, supplied orders, 10,000-order completion, and phone-width overflow.

Node.js 22.16.0 / Python 3.13.5 / Chromium 144.0.7559.96 were available in the Linux validation environment. `docs/test-output.txt` records one executed Node suite; variable timing lines are not speed claims.

## Browser limitations

The environment refused browser navigation to localhost with `ERR_BLOCKED_BY_ADMINISTRATOR`. It was not bypassed. The DOM tests instead loaded the real HTML/CSS and native ES modules in memory, resolving relative modules to blob URLs and mocking only the initial scenario JSON fetch. Actual browser downloads were recomputed with the independent report CLI. This does not verify localhost-origin/CSP behavior, GitHub Pages delivery, Safari, Brave on the user's Mac, or the full deployed request chain.

The Python server tests used real HTTP requests independently of that harness. They do not replace an integrated real-browser check.

## Release boundaries

The repair has not been pushed, retagged or deployed by the review. CI configuration is prepared to run the full check after a separately approved commit. The v1.0 screenshot/release remain historical artifacts. Finite regression tests are not proof that every scenario is correct, a performance benchmark or production approval.
