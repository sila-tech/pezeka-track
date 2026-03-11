# Pezeka Credit: Android Integration Guide

This guide outlines how the Android application should interact with the Firebase backend to ensure compliance with Security Rules and avoid permission errors.

## 1. Authentication
* **Method**: Use Firebase Authentication (Email/Password or Phone).
* **Identity**: The user's `UID` is the primary key used to secure data.

## 2. Customer Profile (`/customers/{uid}`)
* **Read**: The app can read the document at `/customers/YOUR_UID`.
* **Write**: The app can create or update this document.
* **Disbursement Data**: When the user enters their M-Pesa number, you can save it to this document.
* **Important Fields**:
    * `name`: Full name.
    * `phone`: Primary contact.
    * `idNumber`: National ID.
    * `accountNumber`: (Read-only) Assigned by Admin.

## 3. Loan Applications (`/loans`)
The Android app is restricted to **Creating Applications** and **Reading Own Loans**.

### Creating a Loan Application
When pushing a new loan to Firestore, the following rules apply:
* **Collection**: `/loans`
* **Required Fields Checklist** (If any of these are wrong, you get "Insufficient Permissions"):
    1. `customerId`: String. MUST match exactly `FirebaseAuth.getInstance().getCurrentUser().getUid()`.
    2. `status`: String. MUST be exactly `"application"` (lowercase).
    3. `principalAmount`: Number. (e.g., 5000).
    4. `customerName`: String.
    5. `customerPhone`: String.
    6. `disbursementDate`: Timestamp. (Server date).

### Fetching Loan History
* **Query Requirement**: You **cannot** call `get()` on the whole collection. You MUST use a filter:
  `db.collection("loans").whereEqualTo("customerId", currentUid).get()`

## 4. Common Permission Errors (403)
* **Wrong UID**: If `customerId` in the loan object does not match the `UID` of the logged-in user.
* **Unauthorized Status**: Attempting to set `status` to `"active"` or `"paid"` during creation.
* **Listing**: Attempting to fetch all loans without the `customerId` filter.
* **Case Sensitivity**: Ensure `customerId` is lowercase 'c' and uppercase 'I' (CamelCase).

## 5. Shared Terms (Enums)
* **Status**: `application`, `active`, `due`, `overdue`, `paid`, `rollover`, `rejected`.
* **Frequency**: `daily`, `weekly`, `monthly`.
* **Finance Entry Types**: `receipt` (In), `payout` (Out), `expense` (Out). (Android app cannot access these).
