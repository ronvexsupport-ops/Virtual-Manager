# Security Specification: Virtual Manager

## Data Invariants
1. Unauthenticated users cannot read, list, create, update, or delete any record.
2. Every document belongs strictly to its creating user (`userId == request.auth.uid`).
3. No user can read or query another user's contacts, ledger transactions, or profiles.
4. Contacts can only be created by the authenticated owner with valid names, valid types (`customer` | `supplier`), and initial integer balance.
5. Transactions must reference an existing contact owned by the user.
6. Transactions cannot have zero, negative, or non-integer poisha amounts.
7. Transactions cannot be hard-deleted; corrections must use the controlled void workflow (`isVoided = true` with audit reason).
8. Once voided, a transaction cannot be un-voided or altered.
9. Contact balances must accurately reflect atomic updates.

## The Dirty Dozen Payloads
1. **Unauthenticated Read**: Attempting to read `/users/user123` or `/contacts/c1` without auth token -> PERMISSION_DENIED.
2. **Cross-Tenant Read**: User A queries `/contacts` without filtering by their own `userId` -> PERMISSION_DENIED.
3. **Cross-Tenant Update**: User A attempts to edit User B's contact -> PERMISSION_DENIED.
4. **Identity Spoofing**: User A creates a contact with `userId: "userB"` -> PERMISSION_DENIED.
5. **Junk ID Poisoning**: Document ID containing illegal characters or > 128 chars -> PERMISSION_DENIED.
6. **Negative/Zero Amount**: Creating a transaction with `amountInPoisha: -5000` or `0` -> PERMISSION_DENIED.
7. **Floating Point Tampering**: Creating a transaction with `amountInPoisha: 12.34` -> PERMISSION_DENIED.
8. **Un-Voiding Voided Transaction**: Attempting to flip `isVoided: false` on an already voided record -> PERMISSION_DENIED.
9. **Tampering with Void Audit**: Modifying amount or date on an already recorded transaction -> PERMISSION_DENIED.
10. **Arbitrary Schema Injection**: Creating a contact with extra unwanted payload keys like `{ isHacked: true, role: 'admin' }` -> PERMISSION_DENIED.
11. **Hard Delete Prevention**: Attempting to delete a ledger transaction -> PERMISSION_DENIED.
12. **Oversized String Payload**: Contact name or note exceeding character limits (> 500 chars) -> PERMISSION_DENIED.
13. **Foreign / Nonexistent Contact Reference**: User B creates a transaction with `contactId` pointing to User A's contact or a nonexistent ID -> PERMISSION_DENIED via `isContactOwnedByUser(incoming().contactId, request.auth.uid)`.
