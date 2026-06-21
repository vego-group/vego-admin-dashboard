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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.moyasar.com",
              "style-src 'self' 'unsafe-inline' https://cdn.moyasar.com https://basemaps.cartocdn.com",
              "img-src 'self' data: blob: https://mobility-live.com https://*.basemaps.cartocdn.com https://cdn.moyasar.com",
              "font-src 'self' data: https://cdn.moyasar.com",
              "connect-src 'self' https://mobility-live.com https://api.moyasar.com https://*.basemaps.cartocdn.com",
              "frame-src 'self' https://cdn.moyasar.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
