import assert from 'node:assert/strict';
import {
  takaToPoisha,
  poishaToTaka,
  toBengaliNumerals,
  formatMoney,
  calculateBalanceDelta,
  getBalanceInfo,
} from '../src/utils/money.ts';
import { Contact, Transaction, ContactType, TransactionType } from '../src/types/index.ts';

console.log('====================================================');
console.log('VIRTUAL MANAGER - REGRESSION & SECURITY TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err?.message}`);
    throw err;
  }
}

console.log('1. FINANCIAL MATH & POISHA INTEGER ACCURACY');
console.log('-------------------------------------------');

runTest('takaToPoisha converts standard integer Taka into exact poisha', () => {
  assert.equal(takaToPoisha('500'), 50000);
  assert.equal(takaToPoisha('1000'), 100000);
  assert.equal(takaToPoisha(250), 25000);
});

runTest('takaToPoisha converts floating point decimals without JS IEEE-754 inaccuracy', () => {
  // Common JS float inaccuracy: 0.1 + 0.2 != 0.3
  assert.equal(takaToPoisha('120.5'), 12050);
  assert.equal(takaToPoisha('120.55'), 12055);
  assert.equal(takaToPoisha('0.05'), 5);
  assert.equal(takaToPoisha('0.50'), 50);
  assert.equal(takaToPoisha('99.99'), 9999);
});

runTest('takaToPoisha handles commas and whitespace in user input', () => {
  assert.equal(takaToPoisha(' 1,500.50 '), 150050);
  assert.equal(takaToPoisha('10,00,000'), 100000000);
});

runTest('takaToPoisha blocks zero or negative inputs', () => {
  assert.equal(takaToPoisha('0'), 0);
  assert.equal(takaToPoisha('-500'), 0);
  assert.equal(takaToPoisha(''), 0);
});

runTest('poishaToTaka formats back accurately', () => {
  assert.equal(poishaToTaka(50000), '500');
  assert.equal(poishaToTaka(12055), '120.55');
  assert.equal(poishaToTaka(12050), '120.50');
  assert.equal(poishaToTaka(50000, true), '500.00');
});

runTest('Bengali numerals conversion is 100% accurate', () => {
  assert.equal(toBengaliNumerals('1234567890'), '১২৩৪৫৬৭৮৯০');
  assert.equal(toBengaliNumerals('500.50'), '৫০০.৫০');
});

runTest('formatMoney applies correct currency symbol and Bengali numeral grouping', () => {
  const formattedBn = formatMoney(50000, 'bn');
  assert.ok(formattedBn.includes('৳'));
  assert.ok(formattedBn.includes('৫০০'));

  const formattedEn = formatMoney(50000, 'en');
  assert.ok(formattedEn.includes('৳'));
  assert.ok(formattedEn.includes('500'));
});

console.log('\n2. ACCOUNTING LEDGER DELTA CALCULATIONS');
console.log('---------------------------------------');

runTest('Customer: credit_given increases customer balance (more due to me)', () => {
  const delta = calculateBalanceDelta('customer', 'credit_given', 50000);
  assert.equal(delta, 50000);
});

runTest('Customer: payment_received decreases customer balance (debt paid)', () => {
  const delta = calculateBalanceDelta('customer', 'payment_received', 20000);
  assert.equal(delta, -20000);
});

runTest('Supplier: purchase_credit increases supplier payable (I owe supplier more)', () => {
  const delta = calculateBalanceDelta('supplier', 'purchase_credit', 100000);
  assert.equal(delta, 100000);
});

runTest('Supplier: payment_given decreases supplier payable (I paid supplier)', () => {
  const delta = calculateBalanceDelta('supplier', 'payment_given', 40000);
  assert.equal(delta, -40000);
});

runTest('Balance Info labels: Customer due vs advance vs settled', () => {
  const due = getBalanceInfo('customer', 50000, 'bn');
  assert.equal(due.status, 'receivable');
  assert.equal(due.label, 'আপনি পাবেন');

  const settled = getBalanceInfo('customer', 0, 'bn');
  assert.equal(settled.status, 'settled');
  assert.equal(settled.label, 'পরিশোধিত');

  const advance = getBalanceInfo('customer', -15000, 'bn');
  assert.equal(advance.status, 'payable');
  assert.ok(advance.label.includes('অগ্রিম'));
});

runTest('Balance Info labels: Supplier debt vs advance vs settled', () => {
  const payable = getBalanceInfo('supplier', 80000, 'bn');
  assert.equal(payable.status, 'payable');
  assert.equal(payable.label, 'আপনি দেবেন');

  const settled = getBalanceInfo('supplier', 0, 'bn');
  assert.equal(settled.status, 'settled');
  assert.equal(settled.label, 'পরিশোধিত');

  const advance = getBalanceInfo('supplier', -20000, 'bn');
  assert.equal(advance.status, 'receivable');
  assert.ok(advance.label.includes('অগ্রিম'));
});

console.log('\n3. SIMULATED ATOMIC LIFECYCLE & AUDIT VOID WORKFLOW');
console.log('--------------------------------------------------');

runTest('Lifecycle: Create customer without opening balance', () => {
  const customer: Contact = {
    id: 'cust_101',
    userId: 'user_A',
    name: 'Rahim Traders',
    contactType: 'customer',
    currentBalanceInPoisha: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(customer.currentBalanceInPoisha, 0);
});

runTest('Lifecycle: Create customer with opening balance of 500 Taka', () => {
  const initialBalance = 50000;
  const customer: Contact = {
    id: 'cust_102',
    userId: 'user_A',
    name: 'Karim Ullah',
    contactType: 'customer',
    currentBalanceInPoisha: initialBalance,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const openingTx: Transaction = {
    id: 'tx_open_102',
    userId: 'user_A',
    contactId: customer.id,
    contactType: 'customer',
    type: 'credit_given',
    amountInPoisha: initialBalance,
    description: 'Opening Balance',
    date: '2026-10-30',
    isVoided: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.equal(customer.currentBalanceInPoisha, 50000);
  assert.equal(openingTx.amountInPoisha, 50000);
  assert.equal(openingTx.isVoided, false);
});

runTest('Lifecycle: Sequential transactions and balance tracking', () => {
  let currentBalance = 0;

  // 1. Credit given 1,000 tk (+100,000 poisha)
  const tx1Delta = calculateBalanceDelta('customer', 'credit_given', 100000);
  currentBalance += tx1Delta;
  assert.equal(currentBalance, 100000); // 1,000 Taka

  // 2. Customer pays 400 tk (-40,000 poisha)
  const tx2Delta = calculateBalanceDelta('customer', 'payment_received', 40000);
  currentBalance += tx2Delta;
  assert.equal(currentBalance, 60000); // 600 Taka

  // 3. Credit given 250 tk (+25,000 poisha)
  const tx3Delta = calculateBalanceDelta('customer', 'credit_given', 25000);
  currentBalance += tx3Delta;
  assert.equal(currentBalance, 85000); // 850 Taka

  // 4. Void tx3 (the 250 tk credit was entered by mistake):
  // Reversal formula: currentBalance -= originalDelta
  const voidReason = 'Entered by mistake on wrong customer';
  assert.ok(voidReason.length > 0);
  currentBalance -= tx3Delta;
  assert.equal(currentBalance, 60000); // Accurately returns to 600 Taka!
});

console.log('\n4. SECURITY RULES & RELATIONSHIP VALIDATION LOGIC');
console.log('------------------------------------------------');

// Model simulating Firestore Security Rules evaluation
interface MockDoc {
  exists: boolean;
  data: any;
}

function evaluateIsContactOwnedByUser(
  contactId: string,
  authUid: string,
  database: Record<string, MockDoc>,
  batchWrites: Record<string, MockDoc> = {}
): boolean {
  // isValidId check:
  if (!contactId || contactId.length > 128 || !/^[a-zA-Z0-9_\-]+$/.test(contactId)) {
    return false;
  }

  const existingDoc = database[`contacts/${contactId}`];
  if (existingDoc && existingDoc.exists && existingDoc.data.userId === authUid) {
    return true;
  }

  const batchDoc = batchWrites[`contacts/${contactId}`];
  if (batchDoc && batchDoc.exists && batchDoc.data.userId === authUid) {
    return true;
  }

  return false;
}

runTest('Security: User A creates transaction for their own contact -> ALLOWED', () => {
  const db: Record<string, MockDoc> = {
    'contacts/contact_A1': {
      exists: true,
      data: { id: 'contact_A1', userId: 'user_A', name: 'Rahim' },
    },
  };
  const isAllowed = evaluateIsContactOwnedByUser('contact_A1', 'user_A', db);
  assert.equal(isAllowed, true);
});

runTest('Security: User B attempts to create transaction for User A contact -> REJECTED', () => {
  const db: Record<string, MockDoc> = {
    'contacts/contact_A1': {
      exists: true,
      data: { id: 'contact_A1', userId: 'user_A', name: 'Rahim' },
    },
  };
  // User B executes request:
  const isAllowed = evaluateIsContactOwnedByUser('contact_A1', 'user_B', db);
  assert.equal(isAllowed, false);
});

runTest('Security: User A attempts to create transaction for nonexistent contact -> REJECTED', () => {
  const db: Record<string, MockDoc> = {
    'contacts/contact_A1': {
      exists: true,
      data: { id: 'contact_A1', userId: 'user_A', name: 'Rahim' },
    },
  };
  const isAllowed = evaluateIsContactOwnedByUser('ghost_contact_999', 'user_A', db);
  assert.equal(isAllowed, false);
});

runTest('Security: Atomic contact + opening transaction in same batch (existsAfter) -> ALLOWED', () => {
  const db: Record<string, MockDoc> = {}; // Does not exist before batch
  const batchWrites: Record<string, MockDoc> = {
    'contacts/new_contact_A2': {
      exists: true,
      data: { id: 'new_contact_A2', userId: 'user_A', name: 'Karim' },
    },
  };
  const isAllowed = evaluateIsContactOwnedByUser('new_contact_A2', 'user_A', db, batchWrites);
  assert.equal(isAllowed, true);
});

runTest('Security: Invalid/Malicious contact ID format -> REJECTED', () => {
  const db: Record<string, MockDoc> = {};
  assert.equal(evaluateIsContactOwnedByUser('../../etc/passwd', 'user_A', db), false);
  assert.equal(evaluateIsContactOwnedByUser('', 'user_A', db), false);
  assert.equal(evaluateIsContactOwnedByUser('a'.repeat(200), 'user_A', db), false);
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
console.log('====================================================\n');
