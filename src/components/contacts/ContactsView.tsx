import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Contact, ContactType } from '../../types';
import { formatMoney, getBalanceInfo, toBengaliNumerals } from '../../utils/money';
import {
  Search,
  UserPlus,
  Phone,
  MapPin,
  ChevronRight,
  PlusCircle,
  Users,
  Building2,
  PhoneCall,
} from 'lucide-react';

interface ContactsViewProps {
  contacts: Contact[];
  onSelectContact: (contact: Contact) => void;
  onOpenAddContact: (defaultType?: ContactType) => void;
  onOpenAddTransaction: (contactId: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  onSelectContact,
  onOpenAddContact,
  onOpenAddTransaction,
}) => {
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'supplier'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtered contacts based on search query and active tab
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesTab = activeTab === 'all' || c.contactType === activeTab;
      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = c.name.toLowerCase().includes(q);
      const phoneMatch = c.phone?.toLowerCase().includes(q);
      const addressMatch = c.address?.toLowerCase().includes(q);
      return nameMatch || phoneMatch || addressMatch;
    });
  }, [contacts, activeTab, searchQuery]);

  // Aggregate stats for the current tab
  const tabStats = useMemo(() => {
    let receivables = 0;
    let payables = 0;

    filteredContacts.forEach((c) => {
      if (c.contactType === 'customer' && c.currentBalanceInPoisha > 0) {
        receivables += c.currentBalanceInPoisha;
      } else if (c.contactType === 'supplier' && c.currentBalanceInPoisha > 0) {
        payables += c.currentBalanceInPoisha;
      }
    });

    return { receivables, payables, count: filteredContacts.length };
  }, [filteredContacts]);

  return (
    <div className="space-y-3.5 pb-20">
      {/* Search and Add Header */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={() => onOpenAddContact(activeTab === 'supplier' ? 'supplier' : 'customer')}
          className="shrink-0 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer min-h-[40px]"
        >
          <UserPlus className="w-4 h-4" />
          <span className="hidden xs:inline">{t('addContactBtn')}</span>
        </button>
      </div>

      {/* Tabs Filter */}
      <div className="flex border-b border-slate-200 bg-white rounded-xl p-1 shadow-2xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'all'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('allContacts')} ({language === 'bn' ? toBengaliNumerals(contacts.length) : contacts.length})
        </button>
        <button
          onClick={() => setActiveTab('customer')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'customer'
              ? 'bg-teal-700 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('customersTab')}
        </button>
        <button
          onClick={() => setActiveTab('supplier')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center ${
            activeTab === 'supplier'
              ? 'bg-rose-700 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {t('suppliersTab')}
        </button>
      </div>

      {/* Subtotal Banner */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
        <span className="text-slate-600 font-medium">
          {language === 'bn'
            ? `তালিকাভুক্ত: ${toBengaliNumerals(tabStats.count)} টি খাতা`
            : `Showing: ${tabStats.count} ledgers`}
        </span>
        <div className="flex items-center space-x-3 font-semibold">
          {activeTab !== 'supplier' && tabStats.receivables > 0 && (
            <span className="text-emerald-700">
              {t('totalReceivables')}: {formatMoney(tabStats.receivables, language)}
            </span>
          )}
          {activeTab !== 'customer' && tabStats.payables > 0 && (
            <span className="text-rose-700">
              {t('totalPayables')}: {formatMoney(tabStats.payables, language)}
            </span>
          )}
        </div>
      </div>

      {/* Contacts List */}
      {filteredContacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center my-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-2">
            <Users className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">{t('noContactsFound')}</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">{t('noContactsSub')}</p>
          <button
            onClick={() => onOpenAddContact(activeTab === 'supplier' ? 'supplier' : 'customer')}
            className="mt-4 inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer min-h-[40px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('addContactBtn')}</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredContacts.map((contact) => {
            const balanceInfo = getBalanceInfo(
              contact.contactType,
              contact.currentBalanceInPoisha,
              language
            );

            return (
              <div
                key={contact.id}
                onClick={() => onSelectContact(contact)}
                className="bg-white rounded-xl border border-slate-200 hover:border-teal-300 p-3.5 flex items-center justify-between transition-all shadow-2xs hover:shadow-xs cursor-pointer active:bg-slate-50/80"
              >
                {/* Left: Avatar & Contact Info */}
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      contact.contactType === 'customer'
                        ? 'bg-teal-50 text-teal-800 border border-teal-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {contact.name}
                      </h4>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                          contact.contactType === 'customer'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {contact.contactType === 'customer'
                          ? language === 'bn' ? 'কাস্টমার' : 'Customer'
                          : language === 'bn' ? 'সাপ্লায়ার' : 'Supplier'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center text-teal-700 hover:text-teal-900 text-xs"
                          title="Call"
                        >
                          <Phone className="w-3 h-3 mr-1" />
                          <span>{contact.phone}</span>
                        </a>
                      ) : (
                        contact.address && (
                          <span className="inline-flex items-center truncate max-w-[140px] text-slate-400">
                            <MapPin className="w-3 h-3 mr-0.5 shrink-0" />
                            {contact.address}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Balance & Navigation */}
                <div className="flex items-center space-x-2 shrink-0">
                  <div className="text-right">
                    <div className={`text-sm sm:text-base font-extrabold ${balanceInfo.colorClass}`}>
                      {formatMoney(Math.abs(contact.currentBalanceInPoisha), language)}
                    </div>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border ${balanceInfo.bgClass} ${balanceInfo.borderClass} ${balanceInfo.textClass}`}
                    >
                      {balanceInfo.label}
                    </span>
                  </div>

                  <div className="text-slate-300">
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
