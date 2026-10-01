# Design notes

## Separation of concerns

The project keeps warehouse/domain validation, slotting, routing, order generation, simulation metrics and scenario I/O in separate modules.

## Slotting

The optimizer sorts SKUs by ABC activity order and assigns each to the nearest unused compatible reachable slot. Compatibility checks size, weight and zone.

This is deterministic and inspectable. It is not a global constrained-assignment solver.

## Routing

A*, Dijkstra and bidirectional Dijkstra use the same positive entry-cost grid model. A* uses Manhattan distance because movement is orthogonal and the minimum walkable entry cost is 1.

The bidirectional reverse search preserves forward entry-cost semantics by charging the cost of entering the current reverse node.

## Multi-stop picking

For one order, the picker starts at the depot. At every step the nearest reachable unpicked SKU is selected. Shortest-path search supplies the segment. After the final pick the route returns to the depot.

## Simulation

A deterministic seeded generator creates an order set. The exact same order objects are evaluated against current and suggested assignments. This controls the comparison input and prevents a slotting change from receiving an easier order sample.

## Metrics

The report includes total, mean, median, P95, minimum, maximum, and improved / unchanged / worsened order counts.

These are outputs of the implemented model, not predictions of real warehouse labor performance.
