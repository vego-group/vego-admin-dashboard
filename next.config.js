/**
 * HyperPay COPYandPAY (Jordan card top-ups). The widget script URL itself
 * always comes from the backend (`widget_script_url`); these are only the hosts
 * the browser may load the widget, its frames and its styles from, and post its
 * card form to. eu-test is HyperPay's test server; eu-prod is the production
 * host their docs give — confirm it against the host HyperPay issues at go-live.
 */
const HYPERPAY_HOSTS = ['https://eu-test.oppwa.com', 'https://eu-prod.oppwa.com'].join(' ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'mobility-live.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(self)' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.moyasar.com ${HYPERPAY_HOSTS}`,
              `style-src 'self' 'unsafe-inline' https://cdn.moyasar.com ${HYPERPAY_HOSTS}`,
              // Map tiles (src/lib/map-tiles.ts): CARTO's keyed URLs use the bare
              // host, which `*.basemaps.cartocdn.com` does not match; OSM is the
              // stopgap while no key is set.
              `img-src 'self' data: blob: https://mobility-live.com https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tile.openstreetmap.org https://cdn.moyasar.com ${HYPERPAY_HOSTS}`,
              `font-src 'self' data: https://cdn.moyasar.com ${HYPERPAY_HOSTS}`,
              `connect-src 'self' https://mobility-live.com https://api.moyasar.com https://*.basemaps.cartocdn.com ${HYPERPAY_HOSTS}`,
              `frame-src 'self' https://cdn.moyasar.com ${HYPERPAY_HOSTS}`,
              "object-src 'none'",
              "base-uri 'self'",
              // The COPYandPAY card form posts to HyperPay's host.
              `form-action 'self' ${HYPERPAY_HOSTS}`,
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
