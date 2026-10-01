# Warehouse Flow Simulator

An end-to-end browser experiment that connects warehouse slotting with multi-stop order picking and shortest-path routing.

## What it combines

The project grows out of two focused experiments:

- [Warehouse Slotting Lab](https://github.com/dexter02-crypt/warehouse-slotting-lab)
- [Route Craft](https://github.com/dexter02-crypt/route-craft-lab)

Those repositories remain independent. This project combines their ideas into a larger system rather than replacing or merging their histories.

## v1.0 pipeline

1. validate a warehouse grid, depot and storage slots;
2. classify SKUs with ABC and XYZ labels;
3. enforce slot capacity, weight and zone constraints;
4. assign high-activity SKUs to nearer compatible reachable slots;
5. generate a deterministic order set from a seed;
6. plan each multi-stop order with a nearest-next sequence;
7. use shortest-path search between every pick stop;
8. run the **same orders** against current and suggested slotting;
9. compare mean, median, P95 and total travel;
10. report improved, unchanged and worsened orders;
11. replay one suggested pick route on the warehouse map;
12. export scenario and simulation reports as JSON.

Routing supports A*, Dijkstra and bidirectional Dijkstra. The default is A*.

## Run

```bash
python3 serve.py
```

No package installation is required.

## Tests

Node.js 22+:

```bash
npm test
```

The test suite covers grid validation, routing agreement, slot compatibility, ABC/XYZ classification, deterministic order generation, multi-stop picking, scenario round trips and before/after simulation invariants.

## Scope

This is a transparent teaching simulator, not a warehouse management system, digital twin or deployable optimization recommendation.

The slotting heuristic assigns higher-activity SKUs first and chooses the nearest unused compatible reachable slot. The multi-stop picking heuristic repeatedly chooses the currently nearest remaining pick. Neither is presented as a globally optimal solution.

Important effects outside v1.0 include congestion, picker interference, replenishment labor, service-time distributions, one-way aisles, batching/waving policies, equipment reach, dynamic inventory and many facility-specific constraints.

## License

MIT. Maintainer: Shikhar Singh.
