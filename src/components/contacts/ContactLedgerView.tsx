import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Contact, Transaction } from '../../types';
import { formatMoney, getBalanceInfo, toBengaliNumerals } from '../../utils/money';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Edit2,
  PlusCircle,
  Ban,
  Clock,
  CheckCircle,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { VoidTransactionModal } from '../transactions/VoidTransactionModal';

interface ContactLedgerViewProps {
  contact: Contact;
  transactions: Transaction[];
  onBack: () => void;
  onEditContact: (contact: Contact) => void;
  onOpenAddTransaction: (contactId: string) => void;
  onVoidTransaction: (transactionId: string, reason: string) => Promise<void>;
}

export const ContactLedgerView: React.FC<ContactLedgerViewProps> = ({
  contact,
  transactions,
  onBack,
  onEditContact,
  onOpenAddTransaction,
  onVoidTransaction,
}) => {
  const { t, language } = useLanguage();

  const [showVoided, setShowVoided] = useState(true);
  const [selectedTxForVoid, setSelectedTxForVoid] = useState<Transaction | null>(null);

  const balanceInfo = getBalanceInfo(
    contact.contactType,
    contact.currentBalanceInPoisha,
    language
  );

  const displayedTransactions = transactions.filter((tx) =>
    showVoided ? true : !tx.isVoided
  );

  const activeCount = transactions.filter((t) => !t.isVoided).length;
  const voidedCount = transactions.filter((t) => t.isVoided).length;

  return (
    <div className="space-y-4 pb-24">
      {/* 1. Header with Back Button & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'bn' ? 'তালিকায় ফিরে যান' : 'Back to Ledgers'}</span>
        </button>

        <div className="flex items-center space-x-2">
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center space-x-1 py-2 px-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold hover:bg-teal-100 transition-colors cursor-pointer min-h-[40px]"
              title="Call"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{t('callNow')}</span>
            </a>
          )}
          <button
            onClick={() => onEditContact(contact)}
            className="inline-flex items-center space-x-1 py-2 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer min-h-[40px]"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{t('editContactBtn')}</span>
          </button>
        </div>
      </div>

      {/* 2. Contact Summary Card & Giant Balance Badge */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  contact.contactType === 'customer'
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {contact.contactType === 'customer'
                  ? language === 'bn' ? 'কাস্টমার খাতা' : 'Customer Ledger'
                  : language === 'bn' ? 'সাপ্লায়ার খাতা' : 'Supplier Ledger'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {contact.name}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
              {contact.phone && (
                <span className="inline-flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {contact.phone}
                </span>
              )}
              {contact.address && (
                <span className="inline-flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {contact.address}
                </span>
              )}
            </div>
            {contact.notes && (
              <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                {contact.notes}
              </p>
            )}
          </div>

          {/* Current Balance Box */}
          <div
            className={`p-4 rounded-xl border text-right sm:min-w-[180px] ${balanceInfo.bgClass} ${balanceInfo.borderClass}`}
          >
            <span className="text-[11px] font-bold text-slate-600 uppercase block tracking-wider">
              {t('currentBalance')}
            </span>
            <div className={`text-2xl sm:text-3xl font-black mt-0.5 ${balanceInfo.colorClass}`}>
              {formatMoney(Math.abs(contact.currentBalanceInPoisha), language)}
            </div>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded text-[11px] font-bold ${balanceInfo.textClass}`}
            >
              {balanceInfo.label}
            </span>
          </div>
        </div>

        {/* Quick Add Transaction for this contact */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {language === 'bn'
              ? `মোট ${toBengaliNumerals(activeCount)} টি লেনদেন`
              : `Total ${activeCount} active entries`}
          </span>
          <button
            onClick={() => onOpenAddTransaction(contact.id)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-xs font-bold transition-all shadow-sm cursor-pointer min-h-[40px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('recordTransaction')}</span>
          </button>
        </div>
      </div>

      {/* 3. Transaction History Controls */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <Clock className="w-4 h-4 text-teal-700" />
          <span>{t('transactionHistory')}</span>
        </h3>

        {voidedCount > 0 && (
          <button
            onClick={() => setShowVoided(!showVoided)}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
          >
            <Filter className="w-3 h-3" />
            <span>{showVoided ? t('hideVoided') : `${t('showVoided')} (${language === 'bn' ? toBengaliNumerals(voidedCount) : voidedCount})`}</span>
          </button>
        )}
      </div>

      {/* 4. Transactions List */}
      {displayedTransactions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">{t('noTransactionsInLedger')}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            {t('noTransactionsInLedgerSub')}
          </p>
          <button
            onClick={() => onOpenAddTransaction(contact.id)}
            className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer min-h-[40px]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('recordTransaction')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedTransactions.map((tx) => {
            const isCreditGiven = tx.type === 'credit_given';
            const isPaymentReceived = tx.type === 'payment_received';
            const isPurchaseCredit = tx.type === 'purchase_credit';
            const isPaymentGiven = tx.type === 'payment_given';

            let typeLabel = '';
            let isPositiveFlow = false;

            if (contact.contactType === 'customer') {
              if (isCreditGiven) {
                typeLabel = language === 'bn' ? 'বাকী দেওয়া' : 'Credit Given';
                isPositiveFlow = false;
              } else {
                typeLabel = language === 'bn' ? 'টাকা জমা' : 'Payment Received';
                isPositiveFlow = true;
              }
            } else {
              if (isPurchaseCredit) {
                typeLabel = language === 'bn' ? 'বাকি মাল কেনা' : 'Credit Purchase';
                isPositiveFlow = false;
              } else {
                typeLabel = language === 'bn' ? 'টাকা পরিশোধ' : 'Payment Made';
                isPositiveFlow = true;
              }
            }

            return (
              <div
                key={tx.id}
                className={`bg-white rounded-xl border p-3.5 transition-all shadow-2xs ${
                  tx.isVoided
                    ? 'border-slate-200 bg-slate-50/80 opacity-70'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  {/* Left Column: Type, Date, Description */}
                  <div className="min-w-0 pr-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          tx.isVoided
                            ? 'bg-slate-200 text-slate-600'
                            : isPositiveFlow
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {typeLabel}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {language === 'bn' ? toBengaliNumerals(tx.date) : tx.date}
                      </span>
                      {tx.isVoided && (
                        <span className="inline-flex items-center space-x-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800">
                          <Ban className="w-3 h-3 mr-0.5" />
                          {t('voidedBadge')}
                        </span>
                      )}
                    </div>

                    {tx.description && (
                      <p className="text-xs text-slate-700 font-medium mt-1">
                        {tx.description}
                      </p>
                    )}

                    {/* Void reason audit trail display */}
                    {tx.isVoided && tx.voidReason && (
                      <div className="mt-1.5 text-[11px] text-rose-700 bg-rose-50 p-1.5 rounded border border-rose-100 flex items-start space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">{t('voidedReasonPrefix')}</span>{' '}
                          <span>{tx.voidReason}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Amount & Void Action */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-base sm:text-lg font-black ${
                        tx.isVoided
                          ? 'line-through text-slate-400'
                          : isPositiveFlow
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {isPositiveFlow ? '+' : '-'}
                      {formatMoney(tx.amountInPoisha, language)}
                    </div>

                    {!tx.isVoided && (
                      <button
                        onClick={() => setSelectedTxForVoid(tx)}
                        className="mt-1 inline-flex items-center space-x-0.5 text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                        title={t('voidTransactionBtn')}
                      >
                        <Ban className="w-3 h-3" />
                        <span>{t('voidTransactionBtn')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Controlled Void Modal */}
      <VoidTransactionModal
        isOpen={!!selectedTxForVoid}
        transaction={selectedTxForVoid}
        onClose={() => setSelectedTxForVoid(null)}
        onConfirmVoid={onVoidTransaction}
      />
    </div>
  );
};
