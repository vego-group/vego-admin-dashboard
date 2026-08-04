/**
 * Framing a Leaflet map on the data it actually has.
 *
 * Every map in this app opened on a hardcoded Riyadh centre. That was invisible
 * while the mappers also invented Riyadh coordinates for anything unlocated —
 * there was always a marker under the viewport. With those fallbacks removed, a
 * Jordanian fleet would open a correct-but-empty map over Saudi Arabia with its
 * real markers hundreds of kilometres off-screen.
 *
 * The fix is to frame the markers themselves. No coordinate is assumed: if there
 * is nothing to show, the placeholder centre stays and the caller can say the
 * map is empty.
 */

export type LatLngTuple = [number, number];

/** The sliver of the Leaflet namespace this needs. */
interface LeafletBoundsFactory {
  latLngBounds(points: LatLngTuple[]): unknown;
}

/** The sliver of a Leaflet map this needs. */
interface FittableMap {
  fitBounds(bounds: never, options?: { padding?: [number, number]; maxZoom?: number }): void;
}

export interface FitOptions {
  /** Pixels of breathing room around the outermost markers. */
  padding?: [number, number];
  /** Never zoom in past this, so a single marker doesn't fill the screen. */
  maxZoom?: number;
}

/**
 * Frame `points`, returning whether anything was framed.
 *
 * Callers guard this with a ref so it runs **once per map**: refitting on every
 * data refresh would yank the viewport out from under an operator who has panned
 * away, and on the zones map it would fight the polygon-drawing interaction.
 */
export function fitToPoints(
  L: LeafletBoundsFactory,
  map: FittableMap,
  points: LatLngTuple[],
  { padding = [40, 40], maxZoom = 14 }: FitOptions = {},
): boolean {
  if (points.length === 0) return false;
  map.fitBounds(L.latLngBounds(points) as never, { padding, maxZoom });
  return true;
}
