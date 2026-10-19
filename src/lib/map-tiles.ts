/**
 * The basemap under every Leaflet map — the live fleet map (dashboard, stations,
 * fast charging), the swapping-station map and the zones map.
 *
 * CARTO's raster basemaps need an API key since September 2026. A request
 * without one — or with a wrong one — still answers 200, with an "API KEY
 * REQUIRED" watermark tile in place of the map, so nothing in the console says
 * the key is missing or bad: look at the tiles (or at their `ETag`, which starts
 * `wm-` on a watermark).
 *
 * The key is `NEXT_PUBLIC_MAP_TILES_KEY`. It lives only in Vercel's environment,
 * never in the repo, and Next inlines it at build time: setting it takes effect
 * on the next deploy, with no code change. Until then the maps use
 * OpenStreetMap's standard tiles as a stopgap. Those have no dark style, so in
 * dark mode globals.css inverts the fallback tile layer — and nothing above it:
 * markers, zones, popups and controls live in other panes.
 */

export type MapTheme = 'light' | 'dark';

export interface MapTiles {
  /** Leaflet URL template. */
  url: string;
  /** Attribution HTML. A constant — no API value ever goes into it. */
  attribution: string;
  maxZoom: number;
  /** True for the OpenStreetMap stopgap used while no CARTO key is set. */
  isFallback: boolean;
}

/** The value `.env.example` used to ship with — a placeholder, not a key. */
const PLACEHOLDER_KEY = 'your-map-tiles-key';

// Read as the literal `process.env.NEXT_PUBLIC_…`, or Next can't inline it.
const rawKey = (process.env.NEXT_PUBLIC_MAP_TILES_KEY ?? '').trim();
const CARTO_KEY = rawKey && rawKey !== PLACEHOLDER_KEY ? rawKey : null;

/** Positron in light mode, Dark Matter in dark mode. */
const CARTO_STYLE: Record<MapTheme, string> = { light: 'light_all', dark: 'dark_all' };

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * The tiles for `theme`.
 *
 * The CARTO URL is the keyed form CARTO documents for Leaflet (carto.com/basemaps):
 * `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=…`,
 * with `light_all` / `dark_all` in place of `voyager`. The bare host has no
 * `{s}` subdomains.
 *
 * The OSM stopgap follows the tile usage policy: the documented URL, no
 * subdomains, the standard attribution, nothing fetched beyond what the
 * viewport needs.
 */
export function getMapTiles(theme: MapTheme): MapTiles {
  if (CARTO_KEY) {
    return {
      url: `https://basemaps.cartocdn.com/rastertiles/${CARTO_STYLE[theme]}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(CARTO_KEY)}`,
      attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
      maxZoom: 20,
      isFallback: false,
    };
  }
  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
    isFallback: true,
  };
}
