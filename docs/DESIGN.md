# Warehouse Flow Simulator: design and reliability boundaries

## Source authority

The maintenance candidate is based on public commit `7bc775a3ec5dfe5561ed65f05e18d5958d166bbf`, tree `8b343965b9c307a3a4b6d79a6335af2b51d9eac3`. The packaged original v1.0 source plus the exact README/screenshot update reconstruct that tree. Previous passing tests and successful Pages builds are historical evidence, not proof of candidate correctness.

## Validated domain

Runtime paths validate concrete finite numeric values, dense arrays and bounded identifiers. Current and supplied comparison allocations cover exactly the known SKU set. Each slot has at most one SKU. Assigned slots must fit capacity/weight/zone and be reachable from the depot. Unused slots may be unreachable. Slots are traversable pick-access locations, not shelf obstacles.

The validator rejects malformed baseline layouts rather than comparing an invalid baseline with a repaired suggestion. Strict checking does not claim that all real facility constraints are modeled. Extra JSON fields are not a channel for new model behavior; normalized records retain only the implemented fields. Duplicate JSON object keys use the host JSON parser's last-key semantics, not a special duplicate-key detector.

## Assignment feasibility versus optimization

SKUs are sorted by activity, then deterministic code-point identifier order. Eligible slots are sorted by depot cost and identifier. If the next SKU has a free eligible slot, the historical greedy choice is retained. Otherwise the algorithm searches an alternating/augmenting path through previously assigned SKUs and eligible slots. Finding a free endpoint permits a reassignment and increases the matching by one.

If that search exhausts the eligible graph, there is no full compatible reachable assignment for the current prefix. If the work cap is reached, the error says feasibility was not decided. This is distinct from global cost optimization: assignments are feasible, not necessarily minimum-total-picking-cost.

## Routing

The three pathfinders retain the positive entry-cost model. A* uses Manhattan distance; Dijkstra uses zero heuristic. Reverse Dijkstra charges the forward cost of entering the reverse current node. Orthogonal connectivity is symmetric, but entry-weight costs can be direction-dependent. The directed distance cache is tied to the precise validated grid and chosen algorithm; exposed cached records and arrays are frozen.

Internal neighbor traversal reuses the already validated grid rather than cloning it on every expansion. Public validation remains at the boundary. Exhaustive small-grid tests compare all three algorithms against a separately implemented Floyd–Warshall oracle, not just against one another. This is finite test evidence, not a proof for all graphs.

## Order generation

The versioned LCG generator preserves the prior rejection stream for ordinary inputs, including the historical seed-42 scenario. It no longer maps seed 0 to seed 1. With positive demand, zero-frequency SKUs are not selected; if all demand is zero, sampling is uniform. After 1,000 unsuccessful duplicate-avoidance draws for an order, selection continues from the remaining eligible SKUs. It never returns fewer distinct lines than requested merely because the retry counter expired. An explicit workload limit can stop the entire run.

Embedded scenario orders take precedence and are validated, not silently replaced. The same resulting order list is routed for both allocations. The generator version and exact orders are saved in the export.

## Browser state

Load, validation and simulation errors are handled and displayed. Changing controls cancels the logical validity of the previous result and disables report export. Busy controls prevent concurrent runs. Numeric metrics only become available after the entire run and export-size validation finish. Failed runs cannot export prior metrics under changed settings.

The simulation yields after each 50 completed orders. Order generation, validation, slotting, rendering and serialization are still bounded synchronous phases. This is not a web-worker execution engine. SKU/order labels use DOM text nodes and SVG text content rather than interpolated HTML.

## Reproduction and trust

A report records the full normalized scenario, model/engine identity, source of orders, actual order list, both assignments, algorithm and outputs. The verifier validates recorded generation settings, recalculates the comparison and checks summary/per-order results plus first-order paths. It never trusts an exported `verified` flag.

There is no signing key, trusted timestamp or authenticating registry. Internally consistent edits are new experiments, not detectable historical fraud. Source SHA-256 inventories detect byte mismatches relative to the local supplied inventory; they are not signatures. Reports do not replace a model's operating assumptions.

## Bounded work

Grid: 48×32, at most 500 slots. SKU inputs: at most 5,000, but a complete one-per-slot scenario cannot exceed available slots. Up to 10,000 orders with 25 lines each. Individual quantities/capacities/weights: at most 1e9. Text: scenario 1 MiB, report 16 MiB. Generator scan budget: 20 million units; matching repair budget: 10 million traversed eligible edges; oracle search budget: 20 million grid-cell units; retained comparison paths: 2 million vertices. These are implementation work controls, not a formal total-memory guarantee or an untrusted-code sandbox.

## Local tools and publication

The server binds to loopback and serves only `ASSETS.json` members. Host/Origin checks and symlink rejection narrow accidental exposure. The server still depends on trusted local source and a stable local filesystem. Python's basic HTTP implementation is not an internet-facing production server; Pages does not inherit these local headers.

The release check uses real explicit Node test paths, `shell=False`, closed standard input and exit-status propagation. It then runs Python tooling/server tests. Initial-publication functionality is retired because this repository already exists. Updates are ordinary separately reviewed commits; this candidate does not change remote Git state, visibility, release tags, Pages configuration or another repository.
