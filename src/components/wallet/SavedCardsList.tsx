'use client';

import { Check, Loader2, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { SavedCard } from '@/types';

export function brandLabel(brand: string): string {
  const b = brand.toLowerCase();
  if (b.includes('visa')) return 'VISA';
  if (b.includes('master')) return 'Mastercard';
  if (b.includes('mada')) return 'mada';
  if (b.includes('amex') || b.includes('american')) return 'Amex';
  return brand.charAt(0).toUpperCase() + brand.slice(1);
}

interface SavedCardsListProps {
  cards: SavedCard[];
  onRemove: (cardId: string) => void;
  /**
   * Selection mode (the Saudi top-up form): rows are clickable and carry a
   * radio mark. Without it the list is for managing cards only.
   */
  selectedId?: string | null;
  onSelect?: (cardId: string) => void;
  /** The card whose removal is in flight. */
  removingId?: string | null;
}

/**
 * Saved cards from either gateway — Moyasar (Saudi Arabia) and HyperPay
 * (Jordan) — in one list. The API layer already maps Moyasar's `last_four` and
 * HyperPay's `last4` onto the same field.
 */
export function SavedCardsList({ cards, onRemove, selectedId, onSelect, removingId }: SavedCardsListProps) {
  const { t } = useI18n();
  const selectable = !!onSelect;

  return (
    <>
      {cards.map((card) => {
        const selected = selectable && selectedId === card.id;
        const removing = removingId === card.id;
        return (
          <div
            key={card.id}
            className={cn(
              'group flex items-center gap-3 rounded-xl border p-3 transition-colors',
              selectable && 'cursor-pointer',
              selected
                ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10'
                : selectable && 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
            )}
            style={!selected ? { borderColor: 'rgb(var(--border))' } : undefined}
            onClick={selectable ? () => onSelect(card.id) : undefined}
          >
            <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {brandLabel(card.brand)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                <span dir="ltr">•••• {card.last4}</span>
              </p>
              {(card.expMonth && card.expYear) ? (
                <p className="text-[11px] text-slate-400">
                  {t('drivers.expiresShort', {
                    month: String(card.expMonth).padStart(2, '0'),
                    year:  String(card.expYear).slice(-2),
                  })}
                </p>
              ) : card.name ? (
                <p className="truncate text-[11px] text-slate-400">{card.name}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(card.id); }}
              disabled={removing}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-opacity hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10',
                // In the top-up form the remove action stays out of the way until
                // hovered; on the settings list it is the point of the row.
                selectable && !removing && 'opacity-0 group-hover:opacity-100',
              )}
              aria-label={t('drivers.removeCard')}
            >
              {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
            {selectable && (
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600',
                )}
              >
                {selected && <Check className="h-3 w-3" />}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
