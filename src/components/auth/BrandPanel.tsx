import { Bike, Check } from 'lucide-react';

const FEATURES = [
  'Real-time Fleet Monitoring',
  'Smart Charging Management',
  'Comprehensive Analytics',
] as const;

export function BrandPanel() {
  return (
    <div className="hidden w-[340px] shrink-0 flex-col items-center justify-center rounded-3xl bg-white px-10 py-12 shadow-sm lg:flex">
      {/* Icon */}
      <div className="flex h-[120px] w-[120px] items-center justify-center rounded-[28px] bg-indigo-700">
        <Bike className="h-14 w-14 text-white" strokeWidth={1.5} />
      </div>

      <h2 className="mt-6 text-3xl font-bold text-slate-900">MyVego</h2>
      <p className="mt-2 text-center text-base text-slate-500">
        Electric Bike Fleet Management System
      </p>

      <ul className="mt-8 w-full space-y-5">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
            </div>
            <span className="text-base text-slate-700">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
