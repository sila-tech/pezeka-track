# Pezeka Credit: Android Integration Guide

This guide outlines how the Android application should interact with the Firebase backend to ensure compliance with Security Rules and avoid permission errors.

## 1. Authentication
* **Method**: Use Firebase Authentication (Email/Password or Phone).
* **Identity**: The user's `UID` is the primary key used to secure data.

## 2. Customer Profile (`/customers/{uid}`)
* **Read**: The app can read the document at `/customers/YOUR_UID`.
* **Write**: The app can create or update this document.
* **Important Fields**:
    * `name`: Full name.
    * `phone`: Primary contact.
    * `idNumber`: National ID.
    * `accountNumber`: (Read-only) Assigned by Admin.

## 3. Loan Applications (`/loans` or `/loan_applications`)
The Android app is restricted to **Creating Applications** and **Reading Own Loans**.

### Allowed Fields Whitelist (STRICT)
To prevent "Insufficient Permissions," you must **ONLY** send these fields. Injecting other fields (like `interestRate` or `totalPaid`) will cause a crash.

1. `customerId`: String (Must match Auth UID).
2. `status`: String (Must be exactly `"application"`).
3. `amount`: Number (Must be a number, e.g., `5000`).
4. `tenureMonths`: Number.
5. `idNumber`: String.
6. `nextOfKinName`: String.
7. `nextOfKinPhone`: String.
8. `paymentMethod`: String.
9. `accountNumber`: String (Customer's bank/M-Pesa account).
10. `createdAt`: Timestamp.
11. `customerName`: String (Optional).
12. `customerPhone`: String (Optional).

### Fetching Loan History
* **Query Requirement**: You **cannot** call `get()` on the whole collection. You MUST use a filter:
  `db.collection("loans").whereEqualTo("customerId", currentUid).get()`

## 4. Financial Definitions (Matching the Admin Ledger)
To ensure the Android app matches the Admin Dashboard, use these definitions:

*   **Principal Amount (`principalAmount`)**: The gross loan amount before any deductions.
*   **Disbursed Amount (Take-home)**: `principalAmount - (all upfront fees)`. This is the cash the customer actually receives.
*   **Total Repayable (Amount to Pay)**: `principalAmount + interestAmount + totalPenalties`. This is the total amount the customer owes back.
*   **Outstanding Balance**: `totalRepayableAmount - totalPaid`.

## 5. Common Permission Errors (403)
* **Extra Fields**: Attempting to send `principalAmount` or `interestRate` in the initial application. These are calculated by the Finance team during approval.
* **Invalid Type**: Sending `amount` as a String instead of a Number.
* **Wrong UID**: If `customerId` does not match the logged-in user.
* **Privacy Violation**: Attempting to read the `/users` collection (Reserved for Staff).

## 6. Shared Terms (Enums)
* **Status**: `application`, `active`, `due`, `overdue`, `paid`, `rollover`, `rejected`.
* **Frequency**: `daily`, `weekly`, `monthly`.
