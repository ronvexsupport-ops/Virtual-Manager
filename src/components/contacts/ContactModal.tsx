import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Contact, ContactType } from '../../types';
import { takaToPoisha, poishaToTaka } from '../../utils/money';
import { X, User, Phone, MapPin, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    phone?: string;
    address?: string;
    contactType: ContactType;
    notes?: string;
    initialBalanceInPoisha?: number;
  }) => Promise<void>;
  editContact?: Contact | null;
  defaultType?: ContactType;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editContact,
  defaultType = 'customer',
}) => {
  const { t, language } = useLanguage();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [contactType, setContactType] = useState<ContactType>(defaultType);
  const [notes, setNotes] = useState('');
  const [initialTaka, setInitialTaka] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editContact) {
      setName(editContact.name);
      setPhone(editContact.phone || '');
      setAddress(editContact.address || '');
      setContactType(editContact.contactType);
      setNotes(editContact.notes || '');
      setInitialTaka('');
    } else {
      setName('');
      setPhone('');
      setAddress('');
      setContactType(defaultType);
      setNotes('');
      setInitialTaka('');
    }
    setError(null);
  }, [editContact, defaultType, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t('requiredField'));
      return;
    }

    setLoading(true);
    try {
      const initialBalanceInPoisha = !editContact && initialTaka ? takaToPoisha(initialTaka) : 0;
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        contactType,
        notes: notes.trim(),
        initialBalanceInPoisha,
      });
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
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-bold">
              {editContact ? t('editContactBtn') : t('addContactBtn')}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-start space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Contact Type Selector (only for new contacts) */}
          {!editContact && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {t('contactType')} *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContactType('customer')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center space-x-1.5 cursor-pointer min-h-[44px] transition-all ${
                    contactType === 'customer'
                      ? 'bg-teal-50 border-teal-600 text-teal-800 ring-2 ring-teal-500/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{t('customerTypeLabel')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContactType('supplier')}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center space-x-1.5 cursor-pointer min-h-[44px] transition-all ${
                    contactType === 'supplier'
                      ? 'bg-rose-50 border-rose-600 text-rose-800 ring-2 ring-rose-500/30'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{t('supplierTypeLabel')}</span>
                </button>
              </div>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('contactName')} *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('contactNamePlaceholder')}
                required
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('contactPhone')}
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('contactPhonePlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Address Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('contactAddress')}
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('contactAddressPlaceholder')}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Initial Opening Balance (New Contact Only) */}
          {!editContact && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {language === 'bn' ? 'পূর্বের প্রারম্ভিক বাকি (ঐচ্ছিক ৳)' : 'Previous Opening Balance (Optional ৳)'}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">৳</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={initialTaka}
                  onChange={(e) => setInitialTaka(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {contactType === 'customer'
                  ? language === 'bn' ? 'কাস্টমারের কাছে যদি আগে থেকেই টাকা পাওনা থাকে' : 'If customer already owes you money'
                  : language === 'bn' ? 'সাপ্লায়ারকে যদি আগে থেকেই টাকা দিতে বাকি থাকে' : 'If you already owe this supplier money'}
              </p>
            </div>
          )}

          {/* Notes Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('contactNotes')}
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('contactNotesPlaceholder')}
                rows={2}
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
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
              className="flex-1 py-2.5 px-4 bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? t('saving') : editContact ? t('updateContact') : t('saveContact')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
