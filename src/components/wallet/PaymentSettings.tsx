'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, MapPin, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDeleteDialog } from '@/components/ui/ConfirmDeleteDialog';
import { BillingAddressForm } from '@/components/wallet/BillingAddressForm';
import { SavedCardsList } from '@/components/wallet/SavedCardsList';
import { useFleetContext } from '@/hooks/useFleetContext';
import { useI18n } from '@/i18n/I18nProvider';
import { walletApi } from '@/lib/api';
import { logger } from '@/lib/logger';
import type { BillingAddress, SavedCard } from '@/types';

type LoadState = 'loading' | 'loaded' | 'error';

/**
 * "Payment settings" on the Wallet page.
 *
 * - **Billing address** — Jordanian fleets only. HyperPay card payments need it;
 *   one per fleet, shared by its admins. Saudi fleets never see this section.
 * - **Saved cards** — both gateways in one list, with remove. For a HyperPay
 *   card the backend also revokes it at HyperPay. HyperPay cards belong to the
 *   admin who saved them, not to the whole fleet.
 */
export function PaymentSettings() {
  const { t } = useI18n();
  const { isoCountryCode } = useFleetContext();
  const showBilling = isoCountryCode === 'JO';

  // ── Billing address ──
  const [address, setAddress]           = useState<BillingAddress | null>(null);
  const [addressState, setAddressState] = useState<LoadState>('loading');
  const [editing, setEditing]           = useState(false);
  const [justSaved, setJustSaved]       = useState(false);

  const loadAddress = useCallback(() => {
    setAddressState('loading');
    walletApi.getBillingAddress()
      .then((a) => { setAddress(a); setAddressState('loaded'); })
      .catch((err) => {
        logger.warn('[PaymentSettings] billing address unavailable:', err);
        setAddressState('error');
      });
  }, []);

  useEffect(() => {
    if (showBilling) loadAddress();
  }, [showBilling, loadAddress]);

  // ── Saved cards ──
  const [cards, setCards]           = useState<SavedCard[]>([]);
  const [cardsState, setCardsState] = useState<LoadState>('loading');
  const [cardsError, setCardsError] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  /** The card awaiting "Remove this saved card?". */
  const [confirmCardId, setConfirmCardId] = useState<string | null>(null);

  const loadCards = useCallback(() => {
    setCardsState('loading');
    setCardsError('');
    walletApi.listSavedCards()
      .then((list) => { setCards(list); setCardsState('loaded'); })
      .catch((err) => {
        logger.warn('[PaymentSettings] saved cards unavailable:', err);
        setCardsState('error');
      });
  }, []);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleRemove = async (cardId: string) => {
    setConfirmCardId(null);
    setRemovingId(cardId);
    setCardsError('');
    try {
      await walletApi.deleteSavedCard(cardId);
      setCards((list) => list.filter((c) => c.id !== cardId));
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setCardsError(message && !/^HTTP \d{3}$/.test(message) ? message : t('wallet.removeCardFailed'));
    } finally {
      setRemovingId(null);
    }
  };

  const perAdminNote = showBilling || cards.some((c) => c.gateway === 'hyperpay');

  const sectionTitle = (Icon: typeof MapPin, title: string) => (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-slate-400" />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
    </div>
  );

  return (
    <Card className="mt-5 p-5">
      <div className="mb-5">
        <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {t('wallet.paymentSettingsTitle')}
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t('wallet.paymentSettingsSubtitle')}
        </p>
      </div>

      <div className={showBilling ? 'grid grid-cols-1 gap-8 lg:grid-cols-2' : undefined}>
        {/* ── Billing address (Jordan) ── */}
        {showBilling && (
          <section>
            {sectionTitle(MapPin, t('wallet.billingAddressTitle'))}
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t('wallet.billingAddressHint')}</p>

            {addressState === 'loading' ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('common.loading')}
              </div>
            ) : addressState === 'error' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
                <span>{t('wallet.billingLoadFailed')}</span>
                <Button type="button" variant="secondary" size="sm" onClick={loadAddress}>{t('common.retry')}</Button>
              </div>
            ) : editing || !address ? (
              <>
                {!address && (
                  <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                    {t('wallet.billingAddressMissing')}
                  </p>
                )}
                <BillingAddressForm
                  initial={address}
                  submitLabel={t('wallet.billingSave')}
                  onCancel={address ? () => setEditing(false) : undefined}
                  onSaved={(saved) => { setAddress(saved); setEditing(false); setJustSaved(true); }}
                />
              </>
            ) : (
              <div
                className="flex items-start justify-between gap-3 rounded-xl border p-4"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <address className="text-sm not-italic leading-relaxed text-slate-700 dark:text-slate-200">
                  <span className="block">{address.street}</span>
                  <span className="block">{address.city}{address.state ? ` · ${address.state}` : ''}</span>
                  <span className="block tabular-nums" dir="ltr">{address.postcode}</span>
                  {justSaved && (
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('wallet.billingSaved')}
                    </span>
                  )}
                </address>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Pencil className="h-3.5 w-3.5" />}
                  onClick={() => { setJustSaved(false); setEditing(true); }}
                >
                  {t('common.edit')}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* ── Saved cards (both gateways) ── */}
        <section>
          {sectionTitle(CreditCard, t('drivers.savedCards'))}
          {perAdminNote && (
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">{t('wallet.savedCardsPerAdmin')}</p>
          )}

          {cardsState === 'loading' ? (
            <div className="flex items-center gap-2 py-6 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('drivers.savedCardsLoading')}
            </div>
          ) : cardsState === 'error' ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
              <span>{t('wallet.savedCardsLoadFailed')}</span>
              <Button type="button" variant="secondary" size="sm" onClick={loadCards}>{t('common.retry')}</Button>
            </div>
          ) : cards.length === 0 ? (
            <p
              className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-slate-400"
              style={{ borderColor: 'rgb(var(--border))' }}
            >
              {t('drivers.noSavedCards')}
            </p>
          ) : (
            <div className="space-y-2.5">
              <SavedCardsList cards={cards} onRemove={setConfirmCardId} removingId={removingId} />
            </div>
          )}

          {cardsError && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
              {cardsError}
            </div>
          )}
        </section>
      </div>

      <ConfirmDeleteDialog
        open={confirmCardId !== null}
        onClose={() => setConfirmCardId(null)}
        onConfirm={() => { if (confirmCardId) void handleRemove(confirmCardId); }}
        title={t('drivers.removeCardConfirm')}
        confirmLabel={t('drivers.removeCard')}
        cancelLabel={t('common.cancel')}
      />
    </Card>
  );
}
