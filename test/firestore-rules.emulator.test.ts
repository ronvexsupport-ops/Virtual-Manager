import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const PROJECT_ID = 'virtual-manager-security-test';
const RULES = readFileSync('firestore.rules', 'utf8');

let testEnv: RulesTestEnvironment;

async function runLiveEmulatorTests() {
  console.log('================================================================');
  console.log('FIRESTORE SECURITY RULES - LIVE EMULATOR TEST SUITE');
  console.log('================================================================\n');

  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: '127.0.0.1',
      port: 8080,
    },
  });

  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

  let passed = 0;
  let total = 0;

  async function test(name: string, fn: () => Promise<void>) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [EMULATOR PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [EMULATOR FAIL] ${name}`);
      console.error(`    ${err?.message || err}`);
      throw err;
    }
  }

  try {
    // Contexts for test users
    const unauthDb = testEnv.unauthenticatedContext().firestore();
    const userADb = testEnv.authenticatedContext('userA').firestore();
    const userBDb = testEnv.authenticatedContext('userB').firestore();

    console.log('1. UNAUTHENTICATED ACCESS PREVENTION');
    console.log('------------------------------------');

    await test('Unauthenticated user cannot read any contact', async () => {
      await assertFails(getDoc(doc(unauthDb, 'contacts', 'any_contact')));
    });

    await test('Unauthenticated user cannot read any transaction', async () => {
      await assertFails(getDoc(doc(unauthDb, 'transactions', 'any_tx')));
    });

    await test('Unauthenticated user cannot create contacts or transactions', async () => {
      await assertFails(
        setDoc(doc(unauthDb, 'contacts', 'contact_hacked'), {
          id: 'contact_hacked',
          userId: 'userA',
          name: 'Hacked',
          contactType: 'customer',
          currentBalanceInPoisha: 0,
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    console.log('\n2. CONTACT ACCESS & CROSS-USER ISOLATION');
    console.log('----------------------------------------');

    await test('User A creates their own legitimate customer contact', async () => {
      await assertSucceeds(
        setDoc(doc(userADb, 'contacts', 'contactA1'), {
          id: 'contactA1',
          userId: 'userA',
          name: 'Rahim Khan',
          phone: '01712345678',
          address: 'Chawkbazar, Dhaka',
          contactType: 'customer',
          notes: 'Regular retail customer',
          currentBalanceInPoisha: 0,
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    await test('User B CANNOT read User A contact (PERMISSION_DENIED)', async () => {
      await assertFails(getDoc(doc(userBDb, 'contacts', 'contactA1')));
    });

    await test('User B CANNOT update User A contact balance (PERMISSION_DENIED)', async () => {
      await assertFails(
        updateDoc(doc(userBDb, 'contacts', 'contactA1'), {
          currentBalanceInPoisha: 999999,
          updatedAt: new Date().toISOString(),
        })
      );
    });

    await test('User B CANNOT delete User A contact (PERMISSION_DENIED)', async () => {
      await assertFails(deleteDoc(doc(userBDb, 'contacts', 'contactA1')));
    });

    console.log('\n3. TRANSACTION-TO-CONTACT RELATIONSHIP VALIDATION');
    console.log('--------------------------------------------------');

    await test('User A CAN create transaction referencing their own existing contact', async () => {
      await assertSucceeds(
        setDoc(doc(userADb, 'transactions', 'txA1'), {
          id: 'txA1',
          userId: 'userA',
          contactId: 'contactA1',
          contactName: 'Rahim Khan',
          contactType: 'customer',
          type: 'credit_given',
          amountInPoisha: 50000, // ৳ 500
          description: 'Goods on credit',
          date: dateStr,
          isVoided: false,
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    await test('User B CANNOT create transaction referencing User A contact (isContactOwnedByUser fails)', async () => {
      await assertFails(
        setDoc(doc(userBDb, 'transactions', 'txB_malicious'), {
          id: 'txB_malicious',
          userId: 'userB',
          contactId: 'contactA1', // User A's contact!
          contactName: 'Rahim Khan',
          contactType: 'customer',
          type: 'credit_given',
          amountInPoisha: 10000,
          description: 'Malicious forged entry',
          date: dateStr,
          isVoided: false,
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    await test('User A CANNOT create transaction referencing nonexistent contact ID', async () => {
      await assertFails(
        setDoc(doc(userADb, 'transactions', 'txA_ghost'), {
          id: 'txA_ghost',
          userId: 'userA',
          contactId: 'ghost_contact_9999', // Nonexistent contact!
          contactName: 'Phantom Contact',
          contactType: 'customer',
          type: 'credit_given',
          amountInPoisha: 25000,
          description: 'Orphan transaction',
          date: dateStr,
          isVoided: false,
          createdAt: now,
          updatedAt: now,
        })
      );
    });

    console.log('\n4. ATOMIC BATCH CONTACT + OPENING BALANCE VALIDATION (existsAfter)');
    console.log('-------------------------------------------------------------------');

    await test('User A can atomically create a new contact and its opening transaction in same batch', async () => {
      const batch = writeBatch(userADb);
      const newContactRef = doc(userADb, 'contacts', 'contactA_atomic');
      const newTxRef = doc(userADb, 'transactions', 'txA_atomic');

      batch.set(newContactRef, {
        id: 'contactA_atomic',
        userId: 'userA',
        name: 'Atomic Customer',
        contactType: 'customer',
        currentBalanceInPoisha: 100000, // ৳ 1000 opening due
        createdAt: now,
        updatedAt: now,
      });

      batch.set(newTxRef, {
        id: 'txA_atomic',
        userId: 'userA',
        contactId: 'contactA_atomic',
        contactName: 'Atomic Customer',
        contactType: 'customer',
        type: 'credit_given',
        amountInPoisha: 100000,
        description: 'Opening Due Balance',
        date: dateStr,
        isVoided: false,
        createdAt: now,
        updatedAt: now,
      });

      await assertSucceeds(batch.commit());
    });

    console.log('\n5. FINANCIAL AUDIT INTEGRITY & VOID WORKFLOW');
    console.log('--------------------------------------------');

    await test('User A can legitimate void their transaction with reason', async () => {
      await assertSucceeds(
        updateDoc(doc(userADb, 'transactions', 'txA1'), {
          isVoided: true,
          voidReason: 'Mistake in recorded amount, correcting balance',
          voidedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    });

    await test('User B CANNOT void User A transaction (PERMISSION_DENIED)', async () => {
      await assertFails(
        updateDoc(doc(userBDb, 'transactions', 'txA_atomic'), {
          isVoided: true,
          voidReason: 'Unauthorized void attempt by user B',
          voidedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      );
    });

    await test('Transactions CANNOT be hard-deleted by any user (Audit Preservation)', async () => {
      await assertFails(deleteDoc(doc(userADb, 'transactions', 'txA1')));
      await assertFails(deleteDoc(doc(userBDb, 'transactions', 'txA1')));
    });

    console.log('\n================================================================');
    console.log(`EMULATOR TEST RESULTS: ${passed}/${total} TESTS PASSED (100%)`);
    console.log('================================================================\n');
  } finally {
    await testEnv.cleanup();
  }
}

runLiveEmulatorTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
