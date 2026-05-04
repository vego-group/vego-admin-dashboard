# MyVego — Fleet Admin Dashboard

A production-ready, bilingual (English / Arabic) fleet management dashboard for an electric mobility platform. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, Zustand, and Recharts.

## ✨ Features

- **Real-time fleet monitoring** — vehicles with `active` / `charging` / `idle` / `maintenance` statuses
- **Battery station management** — list, map, and card views with availability stats
- **Driver management** — table with status filters, search, and sort
- **Vehicle control** — split layout with engine, lock, speed limit, and emergency stop
- **Reports & analytics** — weekly trips, battery distribution, monthly revenue, cost analysis, top drivers leaderboard
- **Live fleet map** — stylized SVG map with interactive markers and station popovers
- **Bilingual support** — English (LTR) and Arabic (RTL), seamless switch with no page reload
- **Dark / light mode** — smooth toggle with persisted preference
- **Authentication flow** — mocked login with protected routes and role-based structure
- **Mock API layer** — clean abstraction ready for real backend integration

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Type-check
npm run type-check

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000). Use any non-empty email and a password ≥ 4 characters to sign in (default: `admin@myvego.com` / `demo1234`).

## 🏗 Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/login              # Public login page
│   ├── (dashboard)/              # Protected routes
│   │   ├── dashboard
│   │   ├── fleet
│   │   ├── stations
│   │   ├── drivers
│   │   ├── vehicle-control
│   │   └── reports
│   ├── globals.css
│   └── layout.tsx
├── components/
│   ├── ui/                       # Reusable primitives (Button, Card, Badge, etc.)
│   ├── layout/                   # Sidebar, Topbar, DashboardShell
│   ├── dashboard/                # Dashboard-specific widgets
│   ├── fleet/                    # Fleet cards & table
│   ├── stations/                 # Station card
│   ├── drivers/                  # Drivers table
│   ├── vehicle-control/          # Control panel split view
│   ├── reports/                  # Charts & leaderboard
│   └── providers/                # Theme + i18n providers
├── i18n/                         # Translations + provider
│   ├── locales/
│   │   ├── en.ts
│   │   └── ar.ts
│   └── I18nProvider.tsx
├── lib/
│   ├── mock-data/                # Mock vehicles, drivers, stations, metrics
│   ├── api/                      # Mock API layer (swap with real fetch calls)
│   ├── cn.ts                     # className merger
│   └── format.ts                 # Locale-aware number/currency/date formatters
├── store/                        # Zustand stores (auth, ui)
└── types/                        # Domain types
```

### Design system

- **Colors**: brand indigo/navy primary, status-driven accents (emerald / sky / orange / rose), CSS variables for theming
- **Typography**: Plus Jakarta Sans (Latin), IBM Plex Sans Arabic (Arabic) — both via `next/font`
- **Components**: rounded-2xl cards, soft shadows, gradient icon tiles, animated map markers

### Localization

`I18nProvider` synchronizes `<html dir>` and `<html lang>` whenever the locale changes — no page reload required. Translation lookup uses dot-paths (`t('dashboard.title')`) with `{{name}}` interpolation and graceful English fallback. RTL is handled with Tailwind's `rtl:` variant and CSS logical properties (`ms-*` / `me-*`).

### State management

- **`useAuthStore`** — mocked sign-in / sign-out, persisted to localStorage
- **`useUIStore`** — sidebar open/closed and ephemeral UI

### Mock API → Real API

Every page consumes data through `src/lib/api/index.ts`. To wire up a real backend, replace the function bodies with `fetch()` calls. Signatures and return types stay intact.

```ts
// Before (mock)
async list(): Promise<Vehicle[]> {
  await delay();
  return mockVehicles;
}

// After (real)
async list(): Promise<Vehicle[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vehicles`);
  return res.json();
}
```

## 🔐 Auth

- `DashboardShell` redirects unauthenticated users to `/login`
- User has a `role` (`admin` | `operator`) ready for role-based UI gating
- Replace `signIn` in `src/store/auth.ts` with a real backend call when ready

## 🎨 Theming

Theme variables are defined in `src/app/globals.css` under `:root` and `.dark`. `next-themes` handles persistence and SSR-safe hydration.

## 📦 Tech Stack

- **Next.js 14** (App Router, server/client components)
- **TypeScript** (strict mode)
- **Tailwind CSS**
- **Zustand** — state
- **Recharts** — charts
- **Lucide React** — icons
- **next-themes** — theme persistence

## 📄 License

Internal project.
