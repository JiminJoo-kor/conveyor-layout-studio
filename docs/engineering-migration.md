# AUTO ENGINEERING migration log

## Phase 1 — Conveyor compatibility gate

- The comparison layer is read-only. It never writes recommended acceleration, deceleration, or cycle time into equipment parameters.
- `conveyor`, `processLine`, and `sorter` use the simulator's existing full-clear scope: equipment length plus cargo length. The extra cargo length is necessary because the current cycle ends only after the cargo tail clears the equipment.
- A result is `compatible` only when the analytical AUTO ENGINEERING duration is within 0.10 seconds or 2% of the current runtime duration. This allowance covers the current runtime's 10 ms numerical integration.
- Larger differences are `review` and cannot be auto-applied. The comparison includes the old duration, proposed duration, delta, motion profile, and a human-readable reason.
- Other equipment is deliberately reported as `unsupported` until its composed legacy cycle is mapped. This prevents a single-axis motion time from being mistaken for the full cycle of Fork, Lift, AMR/AGV, Turntable, or AS/RS.

Next: expose the Conveyor compatibility result in AUTO ENGINEERING, then connect only `compatible` motion to the simulation behind an explicit migration gate.
