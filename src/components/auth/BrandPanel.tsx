import { Bike, Check } from 'lucide-react';

const FEATURES = [
  'Real-time Fleet Monitoring',
  'Smart Charging Management',
  'Comprehensive Analytics',
] as const;

export function BrandPanel() {
  return (
    <div className="hidden w-64 shrink-0 flex-col items-center justify-center rounded-3xl bg-white px-8 py-10 shadow-sm lg:flex">
      {/* Icon */}
      <div className="flex h-[88px] w-[88px] items-center justify-center rounded-[22px] bg-indigo-700">
        <Bike className="h-11 w-11 text-white" strokeWidth={1.5} />
      </div>

      <h2 className="mt-5 text-[22px] font-bold text-slate-900">MyVego</h2>
      <p className="mt-1.5 text-center text-sm text-slate-500">
        Electric Scooter Fleet Management System
      </p>

      <ul className="mt-6 w-full space-y-3.5">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
            </div>
            <span className="text-sm text-slate-700">{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
