/**
 * The speed limit a fleet can set on a vehicle.
 *
 * **10–80 km/h** — the range the backend's `set_speed_limit` command accepts
 * (FA-204). The slider used to run 0–100, so most of its travel produced a 422
 * that the panel showed as a retryable "failed", and 0 looked like a setting.
 *
 * Zones are a different quantity on a different range: a zone's speed limit is
 * 1–200 or none (`@/lib/zone-types`), it is advisory, and nothing sends it to a
 * vehicle. Only this command changes a vehicle's limit.
 *
 * A vehicle whose limit the backend did not report has an **unknown** limit,
 * not a default one — see {@link import('@/types').Vehicle.speedLimitKmh}.
 */
export const VEHICLE_SPEED_LIMIT_MIN = 10;
export const VEHICLE_SPEED_LIMIT_MAX = 80;

/**
 * Hold a speed inside the settable range, for positioning the slider.
 *
 * Non-finite input resolves to the minimum: an unparseable limit must not
 * become a wide-open one. The label always shows the reported value itself,
 * even when it lies outside the range.
 */
export function clampSpeedLimit(value: number): number {
  if (!Number.isFinite(value)) return VEHICLE_SPEED_LIMIT_MIN;
  return Math.min(VEHICLE_SPEED_LIMIT_MAX, Math.max(VEHICLE_SPEED_LIMIT_MIN, value));
}
