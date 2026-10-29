import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Transaction } from '../../types';
import { formatMoney } from '../../utils/money';
import { AlertTriangle, X, Check, ShieldAlert } from 'lucide-react';

interface VoidTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onConfirmVoid: (transactionId: string, reason: string) => Promise<void>;
}

export const VoidTransactionModal: React.FC<VoidTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onConfirmVoid,
}) => {
  const { t, language } = useLanguage();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(
        language === 'bn'
          ? 'লেনদেন বাতিলের কারণ অবশ্যই উল্লেখ করতে হবে।'
          : 'A reason is strictly required to void a financial transaction.'
      );
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onConfirmVoid(transaction.id, reason.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-rose-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-300" />
            <h3 className="text-base font-bold">{t('voidModalTitle')}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-rose-950/60 hover:bg-rose-950 flex items-center justify-center text-rose-200 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Audit Notice */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{t('voidModalSubtitle')}</p>
          </div>

          {/* Transaction Summary Being Voided */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>{t('confirmAmount')}</span>
              <span className="font-bold text-slate-900 text-sm">
                {formatMoney(transaction.amountInPoisha, language)}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>{t('dateLabel')}:</span>
              <span className="font-medium text-slate-800">{transaction.date}</span>
            </div>
            {transaction.description && (
              <div className="flex justify-between text-slate-600">
                <span>{t('descriptionLabel')}:</span>
                <span className="font-medium text-slate-800 truncate max-w-[200px]">
                  {transaction.description}
                </span>
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('voidReasonLabel')} *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('voidReasonPlaceholder')}
              rows={3}
              required
              className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white resize-none"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          {/* Actions */}
          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[44px]"
            >
              {t('cancelBtn')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-rose-700 hover:bg-rose-800 active:scale-[0.99] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>{loading ? t('processing') : t('confirmVoidBtn')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
