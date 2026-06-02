'use client';

import { useState } from 'react';
import {
  Check, X, Eye, IdCard, FileText, Hash, UserCheck, Users,
  CheckCircle2, XCircle, Phone, Mail, CalendarDays, CreditCard, Car,
  AlertTriangle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useI18n } from '@/i18n/I18nProvider';
import { cn } from '@/lib/cn';
import type { DocumentStatus, DriverRegistrationRequest } from '@/types';

interface PendingRequestsTableProps {
  requests: DriverRegistrationRequest[];
  onApprove: (req: DriverRegistrationRequest) => Promise<void> | void;
  onReject:  (req: DriverRegistrationRequest, reason: string) => Promise<void> | void;
}

// ── Document helpers ───────────────────────────────────────────────────────

const DOC_DOT: Record<DocumentStatus, string> = {
  not_uploaded: 'bg-slate-300 dark:bg-slate-600',
  pending:      'bg-amber-400',
  verified:     'bg-emerald-500',
  rejected:     'bg-rose-500',
};

const DOC_BADGE: Record<DocumentStatus, string> = {
  not_uploaded: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  pending:      'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  verified:     'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
  rejected:     'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
};

const DOC_STATUS_KEY: Record<DocumentStatus, string> = {
  not_uploaded: 'drivers.docNotUploaded',
  pending:      'drivers.docPending',
  verified:     'drivers.docVerified',
  rejected:     'drivers.docRejected',
};

function DocDot({
  status, Icon, docName,
}: {
  status: DocumentStatus; Icon: React.ElementType; docName: string;
}) {
  const { t } = useI18n();
  return (
    <span
      title={`${docName}: ${t(DOC_STATUS_KEY[status])}`}
      className={cn(
        'inline-flex h-6 w-6 items-center justify-center rounded-full text-white transition-transform hover:scale-110',
        DOC_DOT[status]
      )}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useI18n();
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', DOC_BADGE[status])}>
      {t(DOC_STATUS_KEY[status])}
    </span>
  );
}

// ── Time ago ───────────────────────────────────────────────────────────────

function useTimeAgo() {
  const { t } = useI18n();
  return (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return t('common.justNow');
    if (m < 60) return `${m} ${t('common.minAgo')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} ${t('common.hourAgo')}`;
    return `${Math.floor(h / 24)} ${t('common.daysAgo')}`;
  };
}

// ── Approve confirmation modal ─────────────────────────────────────────────

function ApproveConfirmModal({
  req, open, loading, onClose, onConfirm,
}: {
  req: DriverRegistrationRequest; open: boolean; loading: boolean;
  onClose: () => void; onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} size="sm" hideCloseButton>
      <div className="px-6 pb-6 pt-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-500/15">
          <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">
          {t('drivers.approveDriverTitle')}
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t('drivers.approveDriverMessage', { name: req.name })}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="min-w-[110px]">
            {t('common.cancel')}
          </Button>
          <Button variant="success" onClick={onConfirm} isLoading={loading} className="min-w-[140px]">
            <Check className="h-4 w-4" />
            {t('drivers.approve')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Reject confirmation modal (with mandatory reason) ──────────────────────

const MAX_REASON = 500;

function RejectConfirmModal({
  req, open, loading, onClose, onConfirm,
}: {
  req: DriverRegistrationRequest; open: boolean; loading: boolean;
  onClose: () => void; onConfirm: (reason: string) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const tooShort = reason.trim().length < 5;
  const tooLong  = reason.length > MAX_REASON;
  const hasError = touched && (tooShort || tooLong);

  const handleClose = () => {
    setReason('');
    setTouched(false);
    onClose();
  };

  const handleSubmit = () => {
    setTouched(true);
    if (tooShort || tooLong) return;
    onConfirm(reason.trim());
  };

  return (
    <Modal open={open} onClose={handleClose} size="sm" hideCloseButton>
      <div className="px-6 pb-6 pt-8">
        {/* Icon + title */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-500/15">
            <XCircle className="h-7 w-7 text-rose-600 dark:text-rose-400" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">
            {t('drivers.rejectRequestTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('drivers.rejectRequestMessage', { name: req.name })}
          </p>
        </div>

        {/* Reason textarea */}
        <div className="mt-5">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            {t('drivers.rejectReason')} <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            maxLength={MAX_REASON}
            placeholder={t('drivers.rejectReasonPlaceholder')}
            value={reason}
            onChange={(e) => { setReason(e.target.value); setTouched(true); }}
            className={cn(
              'w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm text-slate-700 transition-colors',
              'focus:outline-none focus:ring-2 dark:bg-slate-900/40 dark:text-slate-200',
              hasError
                ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/20'
                : 'focus:border-brand-500 focus:ring-brand-500/20',
            )}
            style={!hasError ? { borderColor: 'rgb(var(--border))' } : undefined}
          />
          <div className="mt-1 flex items-start justify-between gap-2">
            {hasError ? (
              <p className="flex items-center gap-1 text-xs text-rose-600">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {tooShort ? t('drivers.rejectReasonTooShort') : t('drivers.rejectReasonTooLong')}
              </p>
            ) : (
              <span />
            )}
            <span className={cn('shrink-0 text-[11px] tabular-nums', tooLong ? 'text-rose-500' : 'text-slate-400')}>
              {reason.length}/{MAX_REASON}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={handleClose} disabled={loading} className="min-w-[110px]">
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleSubmit} isLoading={loading} className="min-w-[140px]">
            <X className="h-4 w-4" />
            {t('drivers.reject')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── View Details modal ─────────────────────────────────────────────────────

function ViewDetailsModal({
  req, open, onClose, onApprove, onReject,
}: {
  req: DriverRegistrationRequest; open: boolean;
  onClose: () => void; onApprove: () => void; onReject: () => void;
}) {
  const { t } = useI18n();
  const timeAgo = useTimeAgo();
  const docs = req.documents;
  const uploadedCount = [docs.license.status, docs.customsCard.status, docs.plate.status].filter(
    (s) => s !== 'not_uploaded'
  ).length;

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div>
        {/* Header */}
        <div
          className="flex items-center gap-4 border-b px-6 pb-4 pt-5"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-lg font-bold text-white">
            {req.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-50">
              {req.name}
            </h2>
            <p className="text-xs text-slate-400">
              {req.id} · {t('drivers.requestedLabel', { time: timeAgo(req.requestedAt) })}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            {t('drivers.pendingBadge')}
          </span>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">

          {/* Contact info */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('drivers.contactInformation')}
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                {req.phone}
              </div>
              {req.email && (
                <div className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  {req.email}
                </div>
              )}
            </div>
          </div>

          {/* Documents */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t('drivers.documents')}
              </p>
              <span className="text-xs text-slate-400">
                {t('drivers.uploadedCount', { count: uploadedCount })}
              </span>
            </div>
            <div className="space-y-2.5">

              {/* License */}
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10">
                    <IdCard className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t('drivers.drivingLicense')}
                    </p>
                    {docs.license.hasLicense && docs.license.number && (
                      <p className="text-xs text-slate-400">{docs.license.number}</p>
                    )}
                    {!docs.license.hasLicense && (
                      <p className="text-xs text-slate-400">{t('drivers.noLicenseLabel')}</p>
                    )}
                    {docs.license.expiryDate && (
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <CalendarDays className="h-3 w-3" />
                        {t('drivers.expiresLabel')} {docs.license.expiryDate}
                      </div>
                    )}
                  </div>
                </div>
                <DocStatusBadge status={docs.license.status} />
              </div>

              {/* Customs Card */}
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-500/10">
                    <CreditCard className="h-4 w-4 text-violet-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {t('drivers.customsCard')}
                  </p>
                </div>
                <DocStatusBadge status={docs.customsCard.status} />
              </div>

              {/* Plate */}
              <div
                className="flex items-center justify-between rounded-xl border px-4 py-3"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                    <Car className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t('drivers.licensePlate')}
                    </p>
                    {docs.plate.number && (
                      <p className="text-xs text-slate-400">{docs.plate.number}</p>
                    )}
                  </div>
                </div>
                <DocStatusBadge status={docs.plate.status} />
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 border-t bg-slate-50/50 px-6 py-4 dark:bg-slate-900/30"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <Button variant="secondary" onClick={onClose} className="min-w-[90px]">
            {t('common.close')}
          </Button>
          <Button variant="danger" onClick={() => { onClose(); onReject(); }} className="min-w-[110px]">
            <X className="h-4 w-4" />
            {t('drivers.reject')}
          </Button>
          <Button variant="success" onClick={() => { onClose(); onApprove(); }} className="min-w-[120px]">
            <Check className="h-4 w-4" />
            {t('drivers.approve')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type ConfirmState =
  | { type: 'approve'; req: DriverRegistrationRequest }
  | { type: 'reject';  req: DriverRegistrationRequest }
  | null;

export function PendingRequestsTable({ requests, onApprove, onReject }: PendingRequestsTableProps) {
  const { t } = useI18n();
  const timeAgo = useTimeAgo();

  const [viewReq, setViewReq]   = useState<DriverRegistrationRequest | null>(null);
  const [confirm, setConfirm]   = useState<ConfirmState>(null);
  const [acting,  setActing]    = useState(false);

  const openApprove  = (req: DriverRegistrationRequest) => setConfirm({ type: 'approve', req });
  const openReject   = (req: DriverRegistrationRequest) => setConfirm({ type: 'reject',  req });
  const closeConfirm = () => setConfirm(null);

  const handleApproveConfirm = async () => {
    if (!confirm || confirm.type !== 'approve') return;
    setActing(true);
    try { await onApprove(confirm.req); }
    finally { setActing(false); setConfirm(null); }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!confirm || confirm.type !== 'reject') return;
    setActing(true);
    try { await onReject(confirm.req, reason); }
    finally { setActing(false); setConfirm(null); }
  };

  if (requests.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
          <Users className="h-8 w-8 text-slate-400" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-700 dark:text-slate-200">
          {t('drivers.noPendingRequests')}
        </p>
        <p className="mt-1.5 max-w-sm text-sm text-slate-400">
          {t('drivers.noPendingRequestsDescription')}
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        {/* Section header */}
        <div
          className="flex items-center gap-3 border-b px-5 py-4"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-500/15">
            <UserCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t('drivers.registrationRequests')}
            </p>
            <p className="text-xs text-slate-500">{t('drivers.registrationRequestsSubtitle')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 rtl:text-right"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <th className="px-5 py-3.5">{t('drivers.driverColumn')}</th>
                <th className="px-5 py-3.5">{t('drivers.contactColumn')}</th>
                <th className="px-5 py-3.5">{t('drivers.documents')}</th>
                <th className="px-5 py-3.5">{t('drivers.requestedAt')}</th>
                <th className="px-5 py-3.5">{t('drivers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => {
                const docs = req.documents;
                const uploadedCount = [docs.license.status, docs.customsCard.status, docs.plate.status]
                  .filter((s) => s !== 'not_uploaded').length;

                return (
                  <tr
                    key={req.id}
                    className="border-b transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                    style={{ borderColor: 'rgb(var(--border))' }}
                  >
                    {/* Driver */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 text-sm font-bold text-white">
                          {req.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{req.name}</p>
                          <p className="text-xs text-slate-400">#{req.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Contact */}
                    <td className="px-5 py-4">
                      <p className="text-slate-700 dark:text-slate-200">{req.phone}</p>
                      {req.email && <p className="text-xs text-slate-400">{req.email}</p>}
                    </td>

                    {/* Documents */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <DocDot status={docs.license.status}     Icon={IdCard}   docName={t('drivers.drivingLicense')} />
                          <DocDot status={docs.customsCard.status} Icon={FileText} docName={t('drivers.customsCard')} />
                          <DocDot status={docs.plate.status}       Icon={Hash}     docName={t('drivers.licensePlate')} />
                        </div>
                        <span className="text-[10px] tabular-nums text-slate-400">
                          {t('drivers.uploadedCount', { count: uploadedCount })}
                        </span>
                      </div>
                    </td>

                    {/* Requested at */}
                    <td className="px-5 py-4 text-slate-500 dark:text-slate-400">
                      {timeAgo(req.requestedAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewReq(req)}
                          title={t('drivers.viewDetails')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('drivers.viewDetails')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openApprove(req)}
                          title={t('drivers.approve')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-500 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 active:scale-95"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {t('drivers.approve')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openReject(req)}
                          title={t('drivers.reject')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400 active:scale-95"
                        >
                          <X className="h-3.5 w-3.5" />
                          {t('drivers.reject')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* View Details Modal */}
      {viewReq && (
        <ViewDetailsModal
          req={viewReq}
          open={!!viewReq}
          onClose={() => setViewReq(null)}
          onApprove={() => openApprove(viewReq)}
          onReject={() => openReject(viewReq)}
        />
      )}

      {/* Approve confirmation */}
      {confirm?.type === 'approve' && (
        <ApproveConfirmModal
          req={confirm.req}
          open
          loading={acting}
          onClose={closeConfirm}
          onConfirm={handleApproveConfirm}
        />
      )}

      {/* Reject confirmation — with reason textarea */}
      {confirm?.type === 'reject' && (
        <RejectConfirmModal
          req={confirm.req}
          open
          loading={acting}
          onClose={closeConfirm}
          onConfirm={handleRejectConfirm}
        />
      )}
    </>
  );
}
