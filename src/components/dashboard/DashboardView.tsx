import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Contact, Transaction } from '../../types';
import { formatMoney, toBengaliNumerals } from '../../utils/money';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Users,
  UserPlus,
  PlusCircle,
  ArrowRight,
  Clock,
  ShieldCheck,
  Ban,
} from 'lucide-react';

interface DashboardViewProps {
  contacts: Contact[];
  recentTransactions: Transaction[];
  onOpenAddTransaction: (preselectedContactId?: string) => void;
  onOpenAddContact: (defaultType?: 'customer' | 'supplier') => void;
  onSelectContact: (contact: Contact) => void;
  onViewAllContacts: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  contacts,
  recentTransactions,
  onOpenAddTransaction,
  onOpenAddContact,
  onSelectContact,
  onViewAllContacts,
}) => {
  const { t, language } = useLanguage();

  // 1. Calculate Total Receivables (Money customers owe the user)
  // Customer balance > 0 means customer owes user
  const totalReceivablesPoisha = contacts
    .filter((c) => c.contactType === 'customer' && c.currentBalanceInPoisha > 0)
    .reduce((sum, c) => sum + c.currentBalanceInPoisha, 0);

  // 2. Calculate Total Payables (Money user owes suppliers)
  // Supplier balance > 0 means user owes supplier
  const totalPayablesPoisha = contacts
    .filter((c) => c.contactType === 'supplier' && c.currentBalanceInPoisha > 0)
    .reduce((sum, c) => sum + c.currentBalanceInPoisha, 0);

  // 3. Net Balance
  const netBalancePoisha = totalReceivablesPoisha - totalPayablesPoisha;

  // Counts
  const customerCount = contacts.filter((c) => c.contactType === 'customer').length;
  const supplierCount = contacts.filter((c) => c.contactType === 'supplier').length;

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Primary Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Total Receivables (মোট পাওনা / কাস্টমারদের কাছে বাকি) */}
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl p-4 border border-emerald-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 tracking-wide uppercase">
              {t('totalReceivables')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
              {formatMoney(totalReceivablesPoisha, language)}
            </div>
            <p className="text-[11px] text-emerald-800/80 mt-1">
              {t('totalReceivablesSub')} ({language === 'bn' ? toBengaliNumerals(customerCount) : customerCount} {t('totalCustomers')})
            </p>
          </div>
        </div>

        {/* Total Payables (মোট দেনা / সাপ্লায়ারদের পাওনা) */}
        <div className="bg-gradient-to-br from-rose-50 to-white rounded-xl p-4 border border-rose-200/80 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 tracking-wide uppercase">
              {t('totalPayables')}
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">
              {formatMoney(totalPayablesPoisha, language)}
            </div>
            <p className="text-[11px] text-rose-800/80 mt-1">
              {t('totalPayablesSub')} ({language === 'bn' ? toBengaliNumerals(supplierCount) : supplierCount} {t('totalSuppliers')})
            </p>
          </div>
        </div>
      </div>

      {/* 2. Net Balance & Ledger Breakdown Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">{t('netBalance')}</div>
              <div className="text-lg font-bold text-slate-900">
                {formatMoney(Math.abs(netBalancePoisha), language)}
                <span className={`text-xs ml-2 font-semibold ${netBalancePoisha >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {netBalancePoisha >= 0 ? `(${t('netBalancePositive')})` : `(${t('netBalanceNegative')})`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <button
              onClick={() => onOpenAddContact('customer')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 active:bg-teal-200 text-teal-800 text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('newCustomer')}</span>
            </button>
            <button
              onClick={() => onOpenAddContact('supplier')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('newSupplier')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Quick Action Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-xl p-4 text-white shadow-md flex items-center justify-between">
        <div className="min-w-0 pr-3">
          <h3 className="text-sm font-bold truncate leading-tight">
            {language === 'bn' ? 'বাকি বা জমার নতুন হিসাব লিখবেন?' : 'Record a new due or payment?'}
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            {language === 'bn'
              ? 'নিরাপদ অনলাইন হিসাব ও তাৎক্ষণিক ব্যালেন্স সমন্বয়'
              : 'Secure online khata with instant balance recalculation'}
          </p>
        </div>
        <button
          onClick={() => onOpenAddTransaction()}
          className="shrink-0 px-3.5 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer min-h-[40px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{t('recordTransaction')}</span>
        </button>
      </div>

      {/* 4. Recent Transactions Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-teal-700" />
            <h3 className="text-sm font-bold text-slate-900">{t('recentTransactions')}</h3>
          </div>
          <button
            onClick={onViewAllContacts}
            className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center space-x-0.5 cursor-pointer"
          >
            <span>{t('viewAll')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700">{t('noRecentTransactions')}</p>
            <p className="text-xs text-slate-400 mt-0.5 max-w-xs mx-auto">
              {t('noRecentTransactionsSub')}
            </p>
            <button
              onClick={() => onOpenAddTransaction()}
              className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer min-h-[40px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('recordTransaction')}</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentTransactions.slice(0, 8).map((tx) => {
              const matchedContact = contacts.find((c) => c.id === tx.contactId);
              const isCreditGiven = tx.type === 'credit_given';
              const isPaymentReceived = tx.type === 'payment_received';
              const isPurchaseCredit = tx.type === 'purchase_credit';
              const isPaymentGiven = tx.type === 'payment_given';

              // Visual highlight based on accounting event
              let typeLabel = '';
              let isPositiveFlow = false;

              if (tx.contactType === 'customer') {
                if (isCreditGiven) {
                  typeLabel = language === 'bn' ? 'বাকী দেওয়া' : 'Due Given';
                  isPositiveFlow = false; // customer debt increases
                } else {
                  typeLabel = language === 'bn' ? 'টাকা জমা' : 'Payment Received';
                  isPositiveFlow = true; // cash in
                }
              } else {
                if (isPurchaseCredit) {
                  typeLabel = language === 'bn' ? 'বাকি মাল কেনা' : 'Credit Purchase';
                  isPositiveFlow = false; // user debt increases
                } else {
                  typeLabel = language === 'bn' ? 'পরিশোধ' : 'Payment Made';
                  isPositiveFlow = true; // debt cleared
                }
              }

              return (
                <div
                  key={tx.id}
                  onClick={() => matchedContact && onSelectContact(matchedContact)}
                  className={`p-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                    tx.isVoided
                      ? 'bg-slate-50/70 opacity-60'
                      : 'hover:bg-slate-50 active:bg-slate-100'
                  }`}
                >
                  {/* Left: Contact & Details */}
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">
                        {tx.contactName || matchedContact?.name || 'অজানা খাতা'}
                      </span>
                      {tx.isVoided && (
                        <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          <Ban className="w-3 h-3 mr-0.5" />
                          {t('voidedBadge')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                        {typeLabel}
                      </span>
                      <span>•</span>
                      <span>
                        {language === 'bn' ? toBengaliNumerals(tx.date) : tx.date}
                      </span>
                      {tx.description && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[120px] sm:max-w-xs text-slate-600">
                            {tx.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount */}
                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm sm:text-base font-bold ${
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
                    {matchedContact && (
                      <span className="text-[10px] text-teal-700 hover:underline">
                        {t('viewLedger')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Trust & Audit Trail Guarantee */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-slate-600 text-xs flex items-start space-x-2.5">
        <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {language === 'bn'
            ? 'ভার্চুয়াল ম্যানেজার নিরাপদ হিসাব নীতি মেনে চলে। কোনো আর্থিক রেকর্ড মুছে ফেলা হয় না, ভুল এন্ট্রি অডিট ট্রেইলসহ বাতিল করা যায়।'
            : 'Virtual Manager enforces strict audit preservation. Financial entries are never deleted silently; errors are reversed via verified audit voiding.'}
        </p>
      </div>
    </div>
  );
};
