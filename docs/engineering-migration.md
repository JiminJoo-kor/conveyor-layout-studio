# AUTO ENGINEERING migration log

## Phase 1 — Conveyor compatibility gate

- The comparison layer is read-only. It never writes recommended acceleration, deceleration, or cycle time into equipment parameters.
- `conveyor`, `processLine`, and `sorter` use the simulator's existing full-clear scope: equipment length plus cargo length. The extra cargo length is necessary because the current cycle ends only after the cargo tail clears the equipment.
- A result is `compatible` only when the analytical AUTO ENGINEERING duration is within 0.10 seconds or 2% of the current runtime duration. This allowance covers the current runtime's 10 ms numerical integration.
- Larger differences are `review` and cannot be auto-applied. The comparison includes the old duration, proposed duration, delta, motion profile, and a human-readable reason.
- Other equipment is deliberately reported as `unsupported` until its composed legacy cycle is mapped. This prevents a single-axis motion time from being mistaken for the full cycle of Fork, Lift, AMR/AGV, Turntable, or AS/RS.

Next: expose the Conveyor compatibility result in AUTO ENGINEERING, then connect only `compatible` motion to the simulation behind an explicit migration gate.

## Phase 2 — Runtime connection

- Continuous transport equipment uses the analytical engineering duration only when the compatibility gate returns `compatible`.
- `review` and `unsupported` results keep the legacy runtime duration without changing saved parameters.
- The legacy duration remains separately callable for audit and regression comparison.

## Phase 3 — Composed equipment cycles

- AMR, AGV, and Shuttle compare `receive + travel + transfer` as one cycle.
- Fork compares `loaded forward + hold + empty return`.
- Forklift preserves the current `load + loaded travel + unload` scope; the new empty-return axis is displayed but is not silently added to the legacy cycle.
- Lifter preserves the current `load + upward travel + unload` scope; downward return remains outside the legacy cycle until the operational sequence explicitly includes it.
- Turntable maps rotary motion. Turn Conveyor exposes transfer and rotary axes for engineering, but only rotary motion enters the current runtime CT because transfer is not part of the legacy sequence yet.

## Phase 4 — AS/RS target-cell cycle

- X and Z distances come from the actual target cell and the configured inbound or outbound handover position.
- X/Z travel uses `max(X, Z)` for simultaneous mode and `X + Z` for sequential mode.
- Fork extension and retraction are calculated independently, with the configured putaway or retrieval dwell between them.
- Return travel preserves the existing cycle contract. Inbound station time is included; downstream outbound handover remains a separate handshake and is not counted twice.

## Phase 5 — AS/RS Station Conveyor ownership

- AS/RS parameters remain parent-owned. Generated Station Conveyor dimensions, motion values, and internal edges are runtime projections and are omitted from exported layout JSON.
- The parent stores only `stationInterfaces`: interface identity, line/kind binding, and an optional user-adjusted relative placement. This is connection metadata, not a duplicate engineering parameter set.
- External connections are serialized against the parent's `product-N-in/out` ports. Loading calls the existing reconciliation path to regenerate Station Conveyors and internal edges while preserving interface IDs and placements.

## Phase 6 — Pneumatic actuator cycle

- Equipment marked with `equipmentRole: pneumatic` maps to `extend + hold + retract`, even when its generic UI type is `station`.
- The existing `cycleTime` or `processTime` remains the compatibility baseline. The calculated actuator cycle enters the runtime only inside the same 0.10 second / 2% gate; otherwise the legacy time is retained for review.

## Phase 7 — Operational project audit

- The supplied 93-equipment project validated and ran through a compact JSON round-trip without graph errors. Generated Station Conveyors were recreated as six runtime projections with six internal edges.
- The Stacker Crane requires 13.567 kW and 90.45 Nm at 1432 rpm. The standard IEC candidate list now continues through 15, 18.5, and 22 kW, so the first valid candidate is 15 kW instead of an ambiguous `no candidate` result.
- Equipment outside the compatibility tolerance remains on the legacy simulator duration. The audit does not silently apply the shorter AUTO result.
