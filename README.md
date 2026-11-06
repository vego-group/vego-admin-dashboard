# MyVego Fleet Admin

The web dashboard fleet operators use to run their MyVego fleet: drivers,
vehicles, battery swapping and fast charging, zones, alarms, IoT devices,
sessions, reports and driver wallet top-ups.

- English and Arabic, with a right-to-left layout for Arabic. The language
  switches without a page reload. Light and dark themes.
- Fleets in Saudi Arabia and Jordan. A fleet's country, its currency and the
  word for its vehicles come from the backend (`GET /fleet-admin/me`), never
  from the code.
- Every figure comes from the MyVego backend's Fleet Admin API
  (`/fleet-admin/*`). The app has no server code and no mock data of its own:
  pages are rendered statically and call the API from the browser.

## Stack

| | Version |
|---|---|
| Next.js (App Router) | 14.2 |
| React | 18 |
| TypeScript (strict) | 5 |
| Tailwind CSS, next-themes | 3, 0.3 |
| zustand (state) | 4 |
| Recharts (charts) | 2 |
| Leaflet (maps) | 1.9 |
| lucide-react (icons) | 0.424 |

Exact versions are in `package.json` and `package-lock.json`.

## Getting started

You need Node.js 20 (the version CI uses) and npm.

```bash
npm ci
cp .env.example .env.local   # then fill in the values, see below
npm run dev
```

Open http://localhost:3000. It goes to `/dashboard`, or to `/login` when you
are not signed in. Signing in needs a fleet-admin account on the backend that
`NEXT_PUBLIC_API_URL` points to.

| Script | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm run build` | Production build (also lints) |
| `npm run start` | Serves the production build |
| `npm run lint` | ESLint through `next lint` |
| `npm run type-check` | `tsc --noEmit` |

## Environment variables

Both variables are listed in `.env.example`. They start with `NEXT_PUBLIC_`, so
they are public: Next inlines them into the browser bundle at build time. Never
put a secret in one, and rebuild (on Vercel, redeploy) after changing one.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL, no trailing slash. Requests go to `<url>/fleet-admin/...`. Without it, sign-in stops with a "not configured" error. |
| `NEXT_PUBLIC_MAP_TILES_KEY` | CARTO basemaps key for the Leaflet maps. Empty means the maps use OpenStreetMap's standard tiles instead. Set it in Vercel's environment; never commit a key. |

The basemap choice lives in `src/lib/map-tiles.ts`. A CARTO request with a
missing or wrong key still answers 200 with an "API key required" watermark
tile, so check the tiles themselves if the map looks wrong.

## Authentication

- Phone number plus a one-time code. The operator picks the country (the list
  comes from `GET /countries`), enters the national number, and confirms the
  6-digit code on `/otp`. The app sends the number in full E.164 form.
- Fleet-admin accounts only. Sign-in goes through the backend's shared staff
  login, so another kind of account can get a token; `GET /fleet-admin/me` then
  answers 403, and the app signs it out and says why on the login page.
- The bearer token is kept by the auth store (`src/store/auth.ts`, persisted to
  `localStorage`). `src/lib/api/client.ts` attaches it to every request.
- Any 401 ends the session and the login page says it expired.
- Sign-out asks the server to revoke the token. If the server does not confirm
  it, the session still ends in this browser, and the login page says the
  operator was signed out on this device only.
- Everything loaded for one account (fleet profile, currency, notifications) is
  cleared when the session ends or another account signs in. A store that holds
  account data registers its reset with `onAccountChange()`.

## Payments at a glance

Operators top up a driver's wallet from the Drivers page. The backend starts
every top-up and supplies what the gateway's form needs; the app keeps no
gateway keys of its own.

- **Saudi Arabia: Moyasar.** The card form script is added by
  `src/lib/moyasar.ts` only when a top-up reaches the card step, never on other
  pages.
- **Jordan: HyperPay** (COPYandPAY). The widget runs on its own page,
  `/wallet/top-up/pay`, from a script URL and integrity hash the backend sends.
- Both gateways return to `/payment-callback`, which asks the backend to verify
  the payment before it shows a result.
- Card details are typed into the gateway's own form. This app's code never
  reads or sends them.
- The Content Security Policy is in `next.config.js`. A new third-party script,
  style, image, font, frame or API host has to be added there.

## Project layout

```
src/
├── app/                    Next.js App Router
│   ├── (auth)/             /login, /otp
│   ├── (dashboard)/        signed-in pages; DashboardShell sends signed-out
│   │                       visitors to /login
│   └── payment-callback/   where both payment gateways return
├── components/             ui/ primitives, layout/ (shell, sidebar, top bar),
│                           providers/ and feature folders
├── hooks/                  useFleetContext, useVehicleTerm, useCountries, ...
├── i18n/                   I18nProvider and locales/en.ts, locales/ar.ts
├── lib/
│   ├── api/                client.ts (fetch, token, errors) and index.ts
│   │                       (endpoint calls and raw-response mappers)
│   ├── money.ts            fixed-precision money, minor units
│   ├── format.ts           numbers, dates, money, bidi isolation
│   ├── country.ts          countries, dial codes, phone rules, vehicle terms
│   └── ...                 map tiles, payment gateways, zones, logger
├── store/                  zustand stores: auth, notifications, toast, ui
└── types/                  domain types
```

The pages under `(dashboard)`, in menu order: `/dashboard`, `/fleet`,
`/battery-swapping`, `/fast-charging`, `/drivers`, `/sessions`,
`/vehicle-control`, `/iot-devices`, `/zones`, `/alarms`, `/notifications`,
`/reports` and `/wallet`. `/stations` only redirects old bookmarks to
`/battery-swapping`.

Sessions are battery swaps and charging sessions. The platform has no trips.

## Conventions

**Every string in two languages.** UI copy lives in `src/i18n/locales/en.ts`
and `ar.ts`, with the same keys in both. `ar.ts` is typed from the shape of
`en.ts`, so a missing or extra key fails `npm run type-check`. Read text with
`t('section.key', { param })` from `useI18n()`.

**The vehicle noun is data, not copy.** Each country names its vehicles
differently, and the backend sends the word. Never write it into a dictionary.
Use a placeholder and render the key with `tv()` from `useVehicleTerm()`:

- `{{vehicle}}`, plus `{{vehicles}}`, `{{Vehicle}}` and `{{Vehicles}}` for English
- `{{alVehicle}}` for the Arabic definite form, `{{lilVehicle}}` after لِ
- never `ال{{vehicle}}` or `لل{{vehicle}}`: the article cannot be glued on to a
  two-word term
- never make Arabic agree with the noun (no verb, adjective, demonstrative or
  pronoun that takes its gender): one country's term is masculine, another's
  feminine, and the backend does not say which

The header comments of `ar.ts` explain this with examples. Read them before
writing Arabic copy.

**Money is integer minor units.** The backend sends money as a fixed-precision
string with its currency and decimals (SAR has 2, JOD has 3).
`src/lib/money.ts` converts through integer minor units and never uses float
maths or `parseFloat`. In components, format amounts with `formatMoney` from
`useFleetContext()`. There is no default currency: while the fleet profile is
loading, amounts show "—".

**Missing data shows "—".** A value the backend did not send is shown as "—",
never as a made-up number (a missing battery level is "—", not "0%").

**The country is the backend's.** A fleet's country is fixed on its fleet
record. Never derive it from a phone prefix and never send a `?country=`
parameter; the Fleet Admin API answers 422.

**Arabic uses Latin digits.** The helpers in `src/lib/format.ts` do this on
purpose (an Arabic-Indic JOD amount is easy to misread), so format numbers,
dates and money through them.

## Quality gates

GitHub Actions runs `.github/workflows/ci.yml` on every pull request: type
check, lint and a production build, on Node 20. Linting uses `.eslintrc.json`,
which extends `next/core-web-vitals` and `next/typescript`. There is no test
suite.

Run the same checks locally before opening a pull request:

```bash
npm run type-check
npm run lint
npm run build
```

## Deployment

Vercel deploys this repo through its Git integration: each pull request gets a
preview deployment, and merging to `main` deploys production. There is no
deploy workflow in this repo. The environment variables are set in the Vercel
project, and a change to one takes effect from the next deployment.
