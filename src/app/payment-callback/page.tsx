'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { walletApi } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { logger } from '@/lib/logger';

type Status = 'loading' | 'success' | 'failed' | 'pending';

export default function PaymentCallbackPage() {
  const [status, setStatus]     = useState<Status>('loading');
  const [amount, setAmount]     = useState<number | null>(null);
  const [balance, setBalance]   = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState('The payment could not be processed. Please try again.');

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search);
    const paymentId = params.get('id');
    const urlStatus = params.get('status');
    const urlMsg    = params.get('message');

    // Saved-card direct charge already settled server-side (wallet credited).
    // Show the result straight away — re-verifying would risk a double credit.
    if (params.get('settled') === '1' && urlStatus === 'paid') {
      const a = parseFloat(params.get('amount')  ?? '');
      const b = parseFloat(params.get('balance') ?? '');
      setAmount(Number.isFinite(a) ? a : null);
      setBalance(Number.isFinite(b) ? b : null);
      setStatus('success');
      return;
    }

    if (!paymentId) {
      setStatus('failed');
      return;
    }

    // Moyasar says it failed — show immediately, no verify needed
    if (urlStatus === 'failed') {
      if (urlMsg) setErrorMsg(decodeURIComponent(urlMsg).replace(/\+/g, ' '));
      setStatus('failed');
      return;
    }

    // Verify with the backend — `metadata.transaction_id` links to the wallet transaction
    walletApi.verifyTopUp(paymentId)
      .then((result) => {
        const s = (result.status ?? '').toLowerCase();
        if (s === 'completed' || s === 'paid' || s === 'captured') {
          setAmount(result.amount  ?? null);
          setBalance(result.balance ?? null);
          setStatus('success');
        } else if (s === 'failed') {
          setStatus('failed');
        } else {
          setStatus('pending');
        }
      })
      .catch((err) => {
        logger.error('[payment-callback] verifyTopUp error:', err);
        setStatus('failed');
      });
  }, []);

  const goToDrivers = () => { window.location.href = '/drivers'; };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-indigo-500" />
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-50">Verifying payment…</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Please wait a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">Payment Successful</h2>
            {amount != null && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {formatCurrency(amount, 'en')} has been added to the driver&apos;s wallet.
              </p>
            )}
            {balance != null && (
              <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-2.5 dark:bg-emerald-500/10">
                <p className="text-xs text-slate-500 dark:text-slate-400">New wallet balance</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(balance, 'en')}
                </p>
              </div>
            )}
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>
              Back to Drivers
            </Button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-500/10">
              <XCircle className="h-8 w-8 text-rose-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">Payment Failed</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{errorMsg}</p>
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>Back to Drivers</Button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h2 className="mt-4 text-xl font-bold text-slate-900 dark:text-slate-50">Payment Processing</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your payment is being processed. The wallet balance will update shortly.
            </p>
            <Button variant="primary" className="mt-6 w-full" onClick={goToDrivers}>Back to Drivers</Button>
          </>
        )}

      </div>
    </div>
  );
}
