import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase/config';
import { Contact, ContactType, Transaction, TransactionType } from '../types';
import { calculateBalanceDelta } from '../utils/money';

export { calculateBalanceDelta };


/**
 * Real-time subscription to contacts for a given user.
 */
export function subscribeUserContacts(
  userId: string,
  onUpdate: (contacts: Contact[]) => void,
  onError?: (err: Error) => void
) {
  if (!db || !userId) return () => {};

  const contactsRef = collection(db, 'contacts');
  const q = query(
    contactsRef,
    where('userId', '==', userId),
    orderBy('name', 'asc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const contacts: Contact[] = [];
      snapshot.forEach((docSnap) => {
        contacts.push(docSnap.data() as Contact);
      });
      onUpdate(contacts);
    },
    (error) => {
      console.error('Error fetching contacts:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'contacts');
    }
  );
}

/**
 * Real-time subscription to ledger transactions for a contact.
 */
export function subscribeContactTransactions(
  userId: string,
  contactId: string,
  onUpdate: (transactions: Transaction[]) => void,
  onError?: (err: Error) => void
) {
  if (!db || !userId || !contactId) return () => {};

  const txRef = collection(db, 'transactions');
  const q = query(
    txRef,
    where('userId', '==', userId),
    where('contactId', '==', contactId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        txs.push(docSnap.data() as Transaction);
      });
      onUpdate(txs);
    },
    (error) => {
      console.error('Error fetching contact transactions:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    }
  );
}

/**
 * Real-time subscription to recent transactions across all contacts for dashboard.
 */
export function subscribeRecentTransactions(
  userId: string,
  limitCount = 10,
  onUpdate: (transactions: Transaction[]) => void,
  onError?: (err: Error) => void
) {
  if (!db || !userId) return () => {};

  const txRef = collection(db, 'transactions');
  const q = query(
    txRef,
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        txs.push(docSnap.data() as Transaction);
      });
      onUpdate(txs);
    },
    (error) => {
      console.error('Error fetching recent transactions:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    }
  );
}

/**
 * Creates a new customer or supplier contact.
 */
export async function createContact(
  userId: string,
  payload: {
    name: string;
    phone?: string;
    address?: string;
    contactType: ContactType;
    notes?: string;
    initialBalanceInPoisha?: number;
  }
): Promise<Contact> {
  if (!db) throw new Error('Firestore is not initialized');

  const contactsRef = collection(db, 'contacts');
  const newDocRef = doc(contactsRef);
  const now = new Date().toISOString();

  const newContact: Contact = {
    id: newDocRef.id,
    userId,
    name: payload.name.trim(),
    phone: payload.phone?.trim() || '',
    address: payload.address?.trim() || '',
    contactType: payload.contactType,
    notes: payload.notes?.trim() || '',
    currentBalanceInPoisha: payload.initialBalanceInPoisha || 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await runTransaction(db, async (transaction) => {
      transaction.set(newDocRef, newContact);

      // If initial balance is provided, create initial opening transaction
      if (payload.initialBalanceInPoisha && payload.initialBalanceInPoisha > 0) {
        const txDocRef = doc(collection(db, 'transactions'));
        const txType: TransactionType =
          payload.contactType === 'customer' ? 'credit_given' : 'purchase_credit';
        const initialTx: Transaction = {
          id: txDocRef.id,
          userId,
          contactId: newDocRef.id,
          contactName: newContact.name,
          contactType: payload.contactType,
          type: txType,
          amountInPoisha: payload.initialBalanceInPoisha,
          description: 'প্রারম্ভিক বাকি / Opening Balance',
          date: now.split('T')[0],
          isVoided: false,
          createdAt: now,
          updatedAt: now,
        };
        transaction.set(txDocRef, initialTx);
      }
    });

    return newContact;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `contacts/${newDocRef.id}`);
  }
}

/**
 * Updates basic contact info (name, phone, address, notes).
 */
export async function updateContact(
  contactId: string,
  userId: string,
  payload: {
    name: string;
    phone?: string;
    address?: string;
    notes?: string;
  }
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');

  const contactRef = doc(db, 'contacts', contactId);
  try {
    await updateDoc(contactRef, {
      name: payload.name.trim(),
      phone: payload.phone?.trim() || '',
      address: payload.address?.trim() || '',
      notes: payload.notes?.trim() || '',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `contacts/${contactId}`);
  }
}

/**
 * Deletes a contact record.
 */
export async function deleteContactRecord(contactId: string): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  try {
    await deleteDoc(doc(db, 'contacts', contactId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `contacts/${contactId}`);
  }
}

/**
 * Adds a new financial ledger transaction with atomic balance update.
 * Uses Firestore transaction to guarantee mathematical consistency and prevent duplicate double-counting.
 */
export async function recordLedgerTransaction(
  userId: string,
  payload: {
    contactId: string;
    contactName: string;
    contactType: ContactType;
    type: TransactionType;
    amountInPoisha: number;
    description?: string;
    date: string;
  }
): Promise<Transaction> {
  if (!db) throw new Error('Firestore is not initialized');
  if (payload.amountInPoisha <= 0) {
    throw new Error('Transaction amount must be strictly greater than 0 poisha.');
  }

  const now = new Date().toISOString();
  const txRef = doc(collection(db, 'transactions'));
  const contactRef = doc(db, 'contacts', payload.contactId);

  const newTx: Transaction = {
    id: txRef.id,
    userId,
    contactId: payload.contactId,
    contactName: payload.contactName,
    contactType: payload.contactType,
    type: payload.type,
    amountInPoisha: payload.amountInPoisha,
    description: payload.description?.trim() || '',
    date: payload.date || now.split('T')[0],
    isVoided: false,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await runTransaction(db, async (txn) => {
      const contactSnap = await txn.get(contactRef);
      if (!contactSnap.exists()) {
        throw new Error('Target contact does not exist.');
      }

      const contactData = contactSnap.data() as Contact;
      if (contactData.userId !== userId) {
        throw new Error('Target contact does not belong to the authenticated user.');
      }

      const balanceDelta = calculateBalanceDelta(
        payload.contactType,
        payload.type,
        payload.amountInPoisha
      );
      const newBalance = (contactData.currentBalanceInPoisha || 0) + balanceDelta;

      // 1. Write the transaction entry
      txn.set(txRef, newTx);

      // 2. Atomically update contact balance
      txn.update(contactRef, {
        currentBalanceInPoisha: newBalance,
        updatedAt: now,
      });
    });

    return newTx;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `transactions/${txRef.id}`);
  }
}

/**
 * Controlled correction/void workflow that preserves an audit trail.
 * Marks the transaction document as voided with a reason and timestamp,
 * and atomically reverses its financial impact on the contact's balance.
 */
export async function voidLedgerTransaction(
  userId: string,
  transactionId: string,
  reason: string
): Promise<void> {
  if (!db) throw new Error('Firestore is not initialized');
  if (!reason.trim()) {
    throw new Error('A reason is required to void a financial transaction.');
  }

  const now = new Date().toISOString();
  const txRef = doc(db, 'transactions', transactionId);

  try {
    await runTransaction(db, async (txn) => {
      const txSnap = await txn.get(txRef);
      if (!txSnap.exists()) {
        throw new Error('Transaction not found.');
      }

      const txData = txSnap.data() as Transaction;
      if (txData.userId !== userId) {
        throw new Error('Unauthorized to void this transaction.');
      }
      if (txData.isVoided) {
        throw new Error('Transaction is already voided.');
      }

      const contactRef = doc(db, 'contacts', txData.contactId);
      const contactSnap = await txn.get(contactRef);

      if (contactSnap.exists()) {
        const contactData = contactSnap.data() as Contact;
        // Calculate original delta and invert it to reverse the transaction effect
        const originalDelta = calculateBalanceDelta(
          txData.contactType,
          txData.type,
          txData.amountInPoisha
        );
        const correctedBalance = (contactData.currentBalanceInPoisha || 0) - originalDelta;

        txn.update(contactRef, {
          currentBalanceInPoisha: correctedBalance,
          updatedAt: now,
        });
      }

      // Mark transaction as voided, keeping full audit trail
      txn.update(txRef, {
        isVoided: true,
        voidReason: reason.trim(),
        voidedAt: now,
        updatedAt: now,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `transactions/${transactionId}`);
  }
}
