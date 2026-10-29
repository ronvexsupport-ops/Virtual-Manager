/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isFirebaseConfigured, testConnection } from './firebase/config';
import { Contact, Transaction, ContactType } from './types';
import {
  subscribeUserContacts,
  subscribeRecentTransactions,
  subscribeContactTransactions,
  createContact,
  updateContact,
  recordLedgerTransaction,
  voidLedgerTransaction,
} from './services/ledgerService';

import { Navbar } from './components/layout/Navbar';
import { BottomNav, TabType } from './components/layout/BottomNav';
import { AuthModal } from './components/auth/AuthModal';
import { DashboardView } from './components/dashboard/DashboardView';
import { ContactsView } from './components/contacts/ContactsView';
import { ContactLedgerView } from './components/contacts/ContactLedgerView';
import { SettingsView } from './components/settings/SettingsView';
import { ContactModal } from './components/contacts/ContactModal';
import { AddTransactionModal } from './components/transactions/AddTransactionModal';
import { FirebaseSetupNotice } from './components/common/FirebaseSetupNotice';
import { BookOpen } from 'lucide-react';

const MainApp: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();

  const [currentTab, setCurrentTab] = useState<TabType>('dashboard');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactTransactions, setSelectedContactTransactions] = useState<Transaction[]>([]);

  // Modals state
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [preselectedContactId, setPreselectedContactId] = useState<string | undefined>(undefined);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [defaultContactType, setDefaultContactType] = useState<ContactType>('customer');

  // Test Firestore connection on boot as mandated by the Firebase skill
  useEffect(() => {
    testConnection();
  }, []);

  // Real-time listener for user's contacts
  useEffect(() => {
    if (!user) {
      setContacts([]);
      return;
    }
    const unsubscribe = subscribeUserContacts(user.uid, (data) => {
      setContacts(data);
      // Keep selectedContact state in sync with fresh balance
      if (selectedContact) {
        const fresh = data.find((c) => c.id === selectedContact.id);
        if (fresh) setSelectedContact(fresh);
      }
    });
    return () => unsubscribe();
  }, [user, selectedContact?.id]);

  // Real-time listener for user's recent transactions
  useEffect(() => {
    if (!user) {
      setRecentTransactions([]);
      return;
    }
    const unsubscribe = subscribeRecentTransactions(user.uid, 20, (data) => {
      setRecentTransactions(data);
    });
    return () => unsubscribe();
  }, [user]);

  // Real-time listener for selected contact's transactions
  useEffect(() => {
    if (!user || !selectedContact) {
      setSelectedContactTransactions([]);
      return;
    }
    const unsubscribe = subscribeContactTransactions(
      user.uid,
      selectedContact.id,
      (data) => {
        setSelectedContactTransactions(data);
      }
    );
    return () => unsubscribe();
  }, [user, selectedContact?.id]);

  // If Firebase is not configured, show instructions
  if (!isFirebaseConfigured) {
    return <FirebaseSetupNotice />;
  }

  // Loading spinner during auth check
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400 mb-4 animate-pulse">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-base font-bold text-slate-100">{t('appName')}</h2>
        <p className="text-xs text-slate-400 mt-1">{t('loading')}</p>
      </div>
    );
  }

  // If user is not authenticated, render login/signup
  if (!user) {
    return <AuthModal />;
  }

  // Handlers
  const handleOpenAddTransaction = (contactId?: string) => {
    setPreselectedContactId(contactId);
    setIsAddTxOpen(true);
  };

  const handleOpenAddContact = (type: ContactType = 'customer') => {
    setEditingContact(null);
    setDefaultContactType(type);
    setIsContactModalOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setDefaultContactType(contact.contactType);
    setIsContactModalOpen(true);
  };

  const handleSaveContact = async (payload: {
    name: string;
    phone?: string;
    address?: string;
    contactType: ContactType;
    notes?: string;
    initialBalanceInPoisha?: number;
  }) => {
    if (editingContact) {
      await updateContact(editingContact.id, user.uid, payload);
    } else {
      await createContact(user.uid, payload);
    }
  };

  const handleSaveTransaction = async (payload: {
    contactId: string;
    contactName: string;
    contactType: ContactType;
    type: any;
    amountInPoisha: number;
    description?: string;
    date: string;
  }) => {
    await recordLedgerTransaction(user.uid, payload);
  };

  const handleVoidTransaction = async (transactionId: string, reason: string) => {
    await voidLedgerTransaction(user.uid, transactionId, reason);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar onOpenSettings={() => {
        setSelectedContact(null);
        setCurrentTab('settings');
      }} />

      {/* Main Container - Mobile First Max Width */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-3.5 sm:px-6 pt-4 pb-20">
        {selectedContact ? (
          /* Contact Full Ledger Screen */
          <ContactLedgerView
            contact={selectedContact}
            transactions={selectedContactTransactions}
            onBack={() => setSelectedContact(null)}
            onEditContact={handleEditContact}
            onOpenAddTransaction={handleOpenAddTransaction}
            onVoidTransaction={handleVoidTransaction}
          />
        ) : (
          /* Tab Screen */
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                contacts={contacts}
                recentTransactions={recentTransactions}
                onOpenAddTransaction={handleOpenAddTransaction}
                onOpenAddContact={handleOpenAddContact}
                onSelectContact={(contact) => setSelectedContact(contact)}
                onViewAllContacts={() => setCurrentTab('contacts')}
              />
            )}

            {currentTab === 'contacts' && (
              <ContactsView
                contacts={contacts}
                onSelectContact={(contact) => setSelectedContact(contact)}
                onOpenAddContact={handleOpenAddContact}
                onOpenAddTransaction={handleOpenAddTransaction}
              />
            )}

            {currentTab === 'settings' && <SettingsView />}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav
        currentTab={selectedContact ? 'contacts' : currentTab}
        onSelectTab={(tab) => {
          setSelectedContact(null);
          setCurrentTab(tab);
        }}
        onOpenAddTransaction={() => handleOpenAddTransaction()}
      />

      {/* Add / Edit Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        onSave={handleSaveContact}
        editContact={editingContact}
        defaultType={defaultContactType}
      />

      {/* Add Transaction Modal */}
      <AddTransactionModal
        isOpen={isAddTxOpen}
        onClose={() => setIsAddTxOpen(false)}
        contacts={contacts}
        preselectedContactId={preselectedContactId}
        onSave={handleSaveTransaction}
      />
    </div>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
