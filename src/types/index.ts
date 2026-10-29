export type Language = 'bn' | 'en';

export type ContactType = 'customer' | 'supplier';

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  businessName?: string;
  language: Language;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone?: string;
  address?: string;
  contactType: ContactType;
  notes?: string;
  currentBalanceInPoisha: number; // For customer: >0 means customer owes me. For supplier: >0 means I owe supplier.
  createdAt: string;
  updatedAt: string;
}

// Transaction Types
// For customer:
// - credit_given: User gave goods/credit on due -> customer balance increases (+ owes user)
// - payment_received: Customer paid money -> customer balance decreases (- owed)
// For supplier:
// - purchase_credit: User bought goods on due -> supplier payable increases (+ user owes supplier)
// - payment_given: User paid money to supplier -> supplier payable decreases (- debt reduced)
export type TransactionType =
  | 'credit_given'
  | 'payment_received'
  | 'purchase_credit'
  | 'payment_given';

export interface Transaction {
  id: string;
  userId: string;
  contactId: string;
  contactName?: string;
  contactType: ContactType;
  type: TransactionType;
  amountInPoisha: number; // Integer, >= 100 poisha (1 taka)
  description?: string;
  date: string; // YYYY-MM-DD
  isVoided: boolean;
  voidReason?: string;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type BalanceStatus = 'receivable' | 'payable' | 'settled';

export interface BalanceInfo {
  status: BalanceStatus;
  label: string;
  subLabel: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  amountInPoisha: number;
}
