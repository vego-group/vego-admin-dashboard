/**
 * The one scale every speed limit in this app is expressed on.
 *
 * There used to be three, for a single concept:
 *
 *   - the motorcycle mapper defaulted a missing `speed_limit_kmh` to **80**,
 *   - the vehicle control slider ran 0–**45**,
 *   - the zone form slider ran 0–**100**.
 *
 * So a vehicle the backend reported at 80 km/h arrived at a slider that could
 * not represent it: the value pinned to 45, and the first drag of that slider
 * silently *sent* 45 as the fleet's new ceiling. A zone and a vehicle limit, the
 * same quantity in the same unit, were also drawn against different ends.
 *
 * One ceiling now covers both. 100 km/h is the widest of the three, so no limit
 * that already exists — on a zone or on a vehicle — becomes unrepresentable, and
 * nothing clamps on first edit.
 *
 * The mapper's invented 80 is gone rather than moved here: a vehicle whose limit
 * the backend did not report has an **unknown** ceiling, not a default one.
 * See {@link import('@/types').Vehicle.speedLimitKmh}.
 */
export const VEHICLE_SPEED_LIMIT_MAX = 100;

/** Bottom of the scale — 0 km/h is "no riding", a real setting, not "unset". */
export const VEHICLE_SPEED_LIMIT_MIN = 0;

/**
 * Hold a speed inside the scale.
 *
 * Non-finite input resolves to the minimum: an unparseable limit must not become
 * a wide-open one.
 */
export function clampSpeedLimit(value: number): number {
  if (!Number.isFinite(value)) return VEHICLE_SPEED_LIMIT_MIN;
  return Math.min(VEHICLE_SPEED_LIMIT_MAX, Math.max(VEHICLE_SPEED_LIMIT_MIN, value));
}
