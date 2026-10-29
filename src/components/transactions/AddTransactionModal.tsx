import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Contact, ContactType, TransactionType } from '../../types';
import { takaToPoisha, formatMoney, calculateBalanceDelta } from '../../utils/money';
import {
  X,
  PlusCircle,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  User,
} from 'lucide-react';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: Contact[];
  preselectedContactId?: string;
  onSave: (payload: {
    contactId: string;
    contactName: string;
    contactType: ContactType;
    type: TransactionType;
    amountInPoisha: number;
    description?: string;
    date: string;
  }) => Promise<void>;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  contacts,
  preselectedContactId,
  onSave,
}) => {
  const { t, language } = useLanguage();

  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<TransactionType>('credit_given');
  const [amountTaka, setAmountTaka] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<'input' | 'confirm'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set initial selected contact
  useEffect(() => {
    if (preselectedContactId) {
      setSelectedContactId(preselectedContactId);
      const contact = contacts.find((c) => c.id === preselectedContactId);
      if (contact) {
        setTransactionType(contact.contactType === 'customer' ? 'credit_given' : 'purchase_credit');
      }
    } else if (contacts.length > 0 && !selectedContactId) {
      setSelectedContactId(contacts[0].id);
      setTransactionType(
        contacts[0].contactType === 'customer' ? 'credit_given' : 'purchase_credit'
      );
    }
    setStep('input');
    setAmountTaka('');
    setDescription('');
    setError(null);
  }, [isOpen, preselectedContactId, contacts]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId);

  // When selected contact changes, adjust default transaction type
  const handleContactChange = (id: string) => {
    setSelectedContactId(id);
    const c = contacts.find((item) => item.id === id);
    if (c) {
      setTransactionType(c.contactType === 'customer' ? 'credit_given' : 'purchase_credit');
    }
  };

  if (!isOpen) return null;

  // Validation
  const validateAndProceedToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedContact) {
      setError(t('selectContact'));
      return;
    }

    const amountInPoisha = takaToPoisha(amountTaka);
    if (amountInPoisha < 100) {
      // Minimum 1 Taka (100 poisha)
      setError(t('invalidAmount'));
      return;
    }

    if (!date) {
      setError(t('requiredField'));
      return;
    }

    setStep('confirm');
  };

  const handleFinalConfirmSave = async () => {
    if (!selectedContact) return;
    const amountInPoisha = takaToPoisha(amountTaka);

    setLoading(true);
    setError(null);

    try {
      await onSave({
        contactId: selectedContact.id,
        contactName: selectedContact.name,
        contactType: selectedContact.contactType,
        type: transactionType,
        amountInPoisha,
        description: description.trim(),
        date,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || t('error'));
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  // Preview calculations for confirmation
  const amountInPoisha = takaToPoisha(amountTaka);
  const currentBalance = selectedContact?.currentBalanceInPoisha || 0;
  const delta = selectedContact
    ? calculateBalanceDelta(selectedContact.contactType, transactionType, amountInPoisha)
    : 0;
  const newBalance = currentBalance + delta;

  // Quick preset chips
  const quickChips = [
    { label: t('quickNoteCash'), text: language === 'bn' ? 'নগদ জমা' : 'Cash' },
    { label: t('quickNoteGoods'), text: language === 'bn' ? 'পণ্য বাকি' : 'Goods on due' },
    { label: t('quickNoteBill'), text: language === 'bn' ? 'চালান বিল' : 'Invoice' },
    { label: t('quickNotePayment'), text: language === 'bn' ? 'টাকা পরিশোধ' : 'Payment made' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-bold">
              {step === 'confirm' ? t('confirmTitle') : t('addTransactionTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: Input Form */}
        {step === 'input' && (
          <form onSubmit={validateAndProceedToConfirm} className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Contact Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('selectContact')} *
              </label>
              {contacts.length === 0 ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  {t('noContactsSub')}
                </div>
              ) : (
                <select
                  value={selectedContactId}
                  onChange={(e) => handleContactChange(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
                  required
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.contactType === 'customer' ? (language === 'bn' ? 'কাস্টমার' : 'Customer') : (language === 'bn' ? 'সাপ্লায়ার' : 'Supplier')})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Transaction Type Radios */}
            {selectedContact && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {language === 'bn' ? 'লেনদেনের ধরন নির্বাচন করুন' : 'Select Transaction Type'} *
                </label>

                {selectedContact.contactType === 'customer' ? (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransactionType('credit_given')}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        transactionType === 'credit_given'
                          ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{t('customerCreditGiven')}</div>
                          <div className="text-[11px] text-slate-500">
                            {language === 'bn' ? 'পণ্য বা টাকা বাকি দেওয়া হয়েছে' : 'Customer took goods on credit'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-rose-700">+ বাকি</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransactionType('payment_received')}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        transactionType === 'payment_received'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <TrendingDown className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{t('customerPaymentReceived')}</div>
                          <div className="text-[11px] text-slate-500">
                            {language === 'bn' ? 'কাস্টমার টাকা পরিশোধ করেছেন' : 'Customer paid cash'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-emerald-700">- পাওনা কমে</div>
                    </button>
                  </div>
                ) : (
                  // Supplier transaction types
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setTransactionType('purchase_credit')}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        transactionType === 'purchase_credit'
                          ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{t('supplierPurchaseCredit')}</div>
                          <div className="text-[11px] text-slate-500">
                            {language === 'bn' ? 'সাপ্লায়ারের থেকে বাকি মাল আনা হয়েছে' : 'Purchased goods on debt'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-rose-700">+ দেনা বাড়ে</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransactionType('payment_given')}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between cursor-pointer transition-all ${
                        transactionType === 'payment_given'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <TrendingDown className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold">{t('supplierPaymentGiven')}</div>
                          <div className="text-[11px] text-slate-500">
                            {language === 'bn' ? 'সাপ্লায়ারকে টাকা পরিশোধ করা হয়েছে' : 'Debt cleared to vendor'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-emerald-700">- দেনা কমে</div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Giant Touch-friendly Amount Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('amountLabel')} *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xl font-black text-teal-700">৳</span>
                <input
                  type="number"
                  step="any"
                  min="1"
                  value={amountTaka}
                  onChange={(e) => setAmountTaka(e.target.value)}
                  placeholder={t('amountPlaceholder')}
                  required
                  autoFocus
                  className="w-full pl-10 pr-3 py-2 text-xl font-bold bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white tracking-tight"
                />
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('dateLabel')} *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white font-medium"
                />
              </div>
            </div>

            {/* Description & Quick Notes */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  {t('descriptionLabel')}
                </label>
              </div>
              <div className="relative mb-2">
                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('descriptionPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1.5">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDescription(chip.text)}
                    className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Proceed to Confirmation */}
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
                disabled={!selectedContact}
                className="flex-1 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                <span>{language === 'bn' ? 'যাচাই করুন' : 'Review & Confirm'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Clear Confirmation Before Saving */}
        {step === 'confirm' && selectedContact && (
          <div className="p-5 space-y-4">
            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-900 text-xs flex items-start space-x-2">
              <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {t('confirmSubtitle')}
              </p>
            </div>

            {/* Breakdown card */}
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">{t('confirmContactName')}</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedContact.name}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">{t('confirmTransactionType')}</span>
                <span className="font-semibold text-slate-800">
                  {transactionType === 'credit_given' && t('customerCreditGiven')}
                  {transactionType === 'payment_received' && t('customerPaymentReceived')}
                  {transactionType === 'purchase_credit' && t('supplierPurchaseCredit')}
                  {transactionType === 'payment_given' && t('supplierPaymentGiven')}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">{t('confirmAmount')}</span>
                <span className="font-black text-slate-900 text-base">
                  {formatMoney(amountInPoisha, language)}
                </span>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">{t('confirmPreviousBalance')}</span>
                <span className="font-semibold text-slate-700">
                  {formatMoney(Math.abs(currentBalance), language)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-900 font-bold">{t('confirmNewBalance')}</span>
                <span className="font-black text-teal-800 text-base">
                  {formatMoney(Math.abs(newBalance), language)}
                </span>
              </div>
            </div>

            {description && (
              <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="font-semibold">{t('descriptionLabel')}:</span> {description}
              </p>
            )}

            {/* Action buttons with Duplicate Prevention */}
            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setStep('input')}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer min-h-[44px]"
              >
                {t('editAgainBtn')}
              </button>
              <button
                type="button"
                onClick={handleFinalConfirmSave}
                disabled={loading}
                className="flex-1 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? t('saving') : t('confirmSaveBtn')}</span>
              </button>
            </div>

            {loading && (
              <p className="text-[11px] text-center text-teal-800 font-medium">
                {t('duplicatePrevention')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
