# Virtual Manager (ভার্চুয়াল ম্যানেজার)
### Digital Due Ledger & Debt Accounting Web App (ডিজিটাল বাকি খাতা)

Virtual Manager is a mobile-first, production-ready web application for Bangladeshi small and medium enterprises (MSMEs), shop owners, traders, and suppliers. It replaces paper khata books with a secure, real-time online ledger for tracking customer dues (পাওনা / receivables) and supplier debts (দেনা / payables).

---

## 🌟 Key Features

1. **Dual Language Support (বাংলা & English)**:
   - Full native Bengali UI by default (`Noto Sans Bengali` font with standard fallbacks).
   - Easily switch between Bengali and English at any time.
   - Authentic Bangladeshi accounting terminology (বাকী দেওয়া, টাকা জমা, মাল কেনা, পরিশোধ, নিট স্থিতি).
   - Bangladeshi Taka (`৳`) currency representation with Bengali & English numerals.

2. **Accurate Poisha-based Math (Never Floats)**:
   - All financial balances and calculations are executed in integer **Poisha** (`1 Taka = 100 Poisha`).
   - Completely eliminates floating-point rounding errors common in javascript.

3. **Customer & Supplier Ledger Management**:
   - Customer ledger: Tracks debts incurred by customers (`credit_given`) and payments received (`payment_received`).
   - Supplier ledger: Tracks purchase credits (`purchase_credit`) and payments made (`payment_given`).
   - Clear direction indicators: "আপনি পাবেন" (You will receive), "আপনি দেবেন" (You will pay), and "পরিশোধিত" (Settled).

4. **Immutable Audit Trail & Controlled Void Workflow**:
   - Financial entries are **never silently overwritten or deleted**.
   - Accidental entries are corrected via a formal **Void (বাতিল)** procedure requiring an audit reason, marking the transaction as voided while atomically recalculating the contact balance.

5. **Two-Step Confirmation & Duplicate Prevention**:
   - Explicit review modal before recording any ledger transaction displaying contact name, type, previous balance, and projected new balance.
   - Disabled submission states to prevent duplicate double-counting.

6. **Mobile-First Responsive Design**:
   - Tailored specifically for Android smartphones (tested down to 320px screen width) up to tablets and desktops.
   - Touch targets $\ge 44 \times 44\text{px}$.
   - Bottom navigation bar with elevated Center Quick Action button.
   - Stacked card rows instead of wide overflowing tables.

7. **Zero-Trust Firebase Cloud Security**:
   - User-scoped security boundaries in Firestore (`userId == request.auth.uid`).
   - Attribute-Based Access Control rules preventing cross-user data exposure.

---

## 🏗️ Architecture & Firestore Schema

### 1. Collections

#### `/users/{userId}`
User profile settings and business details.
```json
{
  "id": "USER_UID",
  "email": "owner@example.com",
  "displayName": "Rahim Khan",
  "businessName": "Rahim Traders",
  "language": "bn",
  "createdAt": "2026-10-29T11:00:00.000Z",
  "updatedAt": "2026-10-29T11:00:00.000Z"
}
```

#### `/contacts/{contactId}`
Customer and supplier records scoped to user.
```json
{
  "id": "CONTACT_ID",
  "userId": "USER_UID",
  "name": "Karim Uddin",
  "phone": "01712345678",
  "address": "Chawkbazar, Dhaka",
  "contactType": "customer",
  "notes": "Weekly grocery buyer",
  "currentBalanceInPoisha": 50000,
  "createdAt": "2026-10-29T11:00:00.000Z",
  "updatedAt": "2026-10-29T11:00:00.000Z"
}
```

#### `/transactions/{transactionId}`
Immutable ledger entries.
```json
{
  "id": "TX_ID",
  "userId": "USER_UID",
  "contactId": "CONTACT_ID",
  "contactName": "Karim Uddin",
  "contactType": "customer",
  "type": "credit_given",
  "amountInPoisha": 50000,
  "description": "50kg Miniket Rice",
  "date": "2026-10-29",
  "isVoided": false,
  "voidReason": "",
  "voidedAt": "",
  "createdAt": "2026-10-29T11:00:00.000Z",
  "updatedAt": "2026-10-29T11:00:00.000Z"
}
```

---

## 🔒 Firestore Security Rules Summary

The application deploys hardened security rules following the Eight Pillars:
- **Default Deny**: All unauthenticated reads and writes are blocked.
- **Strict User Isolation**: `allow list, get, create, update: if isSignedIn() && resource.data.userId == request.auth.uid`.
- **Audit Preservation**: Direct `delete` on `/transactions` is completely disallowed (`allow delete: if false;`).
- **Void Restriction**: Updates to `/transactions` are only permitted for transitioning `isVoided: false` to `isVoided: true` with a mandatory `voidReason`, while amounts, types, and dates remain strictly immutable.

---

## 🚀 Local Development Setup

### Prerequisites
- Node.js 18+ or 20+
- npm or bun

### Steps
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Verify environment configuration:
   Copy `.env.example` to `.env` or ensure `firebase-applet-config.json` is present in the workspace root.
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser (or use device emulation mode for mobile preview).

---

## 🌐 Vercel Deployment Instructions

1. Push your code to GitHub / GitLab / Bitbucket.
2. In the Vercel Dashboard, select **Add New Project** and import your repository.
3. Set Framework Preset to **Vite**.
4. Under **Environment Variables**, provide the following client variables from your Firebase Console:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_DATABASE_ID` (if using custom named database)
5. Deploy! `vercel.json` will automatically configure client-side SPA routing.

---

## ✅ Practical Test Checklist

### 1. Authentication
- [ ] Sign up with email/password creates a valid user profile document in `/users/{userId}`.
- [ ] Login succeeds with valid credentials; invalid passwords display Bengali/English error.
- [ ] Password reset trigger sends verification email.
- [ ] Google Sign-In popup authenticates seamlessly.
- [ ] Logging out securely clears local session and returns to login screen.

### 2. Contacts Management
- [ ] Add new customer with initial opening balance.
- [ ] Add new supplier.
- [ ] Search contacts by name, phone number, and address.
- [ ] Filter by tabs: All, Customers, Suppliers.
- [ ] Edit contact name, phone, address, and notes.

### 3. Ledger Calculations & Math Accuracy
- [ ] Adding `credit_given` (500 ৳) to customer increases balance by exactly 500 ৳ (50,000 poisha).
- [ ] Adding `payment_received` (200 ৳) decreases customer balance to 300 ৳.
- [ ] Adding `purchase_credit` (1,000 ৳) to supplier increases payable debt by 1,000 ৳.
- [ ] Adding `payment_given` (400 ৳) to supplier decreases payable debt to 600 ৳.
- [ ] Partial poisha inputs (e.g., 150.50 ৳) store as 15,050 poisha with zero loss of precision.

### 4. Duplicate Submission & Validation
- [ ] Submitting empty amount or 0 ৳ is blocked by validation.
- [ ] Two-step confirmation dialog displays contact name, old balance, amount, and projected new balance.
- [ ] Double-clicking the save button is prevented by immediate button disable state.

### 5. Audit Trail & Void Workflow
- [ ] Active transaction displays "বাতিল করুন" (Void) button.
- [ ] Void modal mandates entering a reason.
- [ ] Upon confirmation, transaction is marked with voided badge and audit reason.
- [ ] Contact balance is atomically reversed back to the exact previous balance.
- [ ] Voided transactions cannot be un-voided or edited.

### 6. Data Isolation
- [ ] Logging into Account A only displays Account A's contacts and transactions.
- [ ] Cross-tenant access is rejected by Firestore security rules.

### 7. Mobile Layouts & Viewports
- [ ] Responsive UI verified at 320px, 360px, 375px, 390px, 414px, and 768px+.
- [ ] Zero horizontal page overflow (`overflow-x-hidden`).
- [ ] All touch buttons adhere to $\ge 44\text{px}$ touch targets.
- [ ] Bengali typography renders cleanly without clipped or disjointed glyphs.
