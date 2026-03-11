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

## 3. Loan Applications (`/loans`)
The Android app is restricted to **Creating Applications** and **Reading Own Loans**.

### Creating a Loan Application
When pushing a new loan to Firestore, the following rules apply:
* **Collection**: `/loans`
* **Required Fields**:
    * `customerId`: MUST match the current User UID.
    * `status`: MUST be exactly `"application"`.
    * `customerName`: User's name.
    * `customerPhone`: User's phone.
    * `principalAmount`: Number (The requested amount).
    * `loanType`: String (e.g., "Quick Pesa").
    * `disbursementDate`: Timestamp (Application date).
* **Forbidden**: Setting `status` to `"active"`, `"paid"`, or setting `interestRate` will trigger a permission error.

### Fetching Loan History
* **Query Requirement**: You **cannot** call `get()` on the whole collection. You MUST use a filter:
  `db.collection("loans").whereEqualTo("customerId", currentUid).get()`

## 4. Common Permission Errors (403)
* **Wrong UID**: If `customerId` != `request.auth.uid`.
* **Unauthorized Write**: Attempting to update a loan after it is created.
* **Listing**: Attempting to fetch all loans without the `customerId` filter.

## 5. Shared Terms (Enums)
* **Status**: `application`, `active`, `due`, `overdue`, `paid`, `rollover`, `rejected`.
* **Frequency**: `daily`, `weekly`, `monthly`.
* **Finance Entry Types**: `receipt` (In), `payout` (Out), `expense` (Out). (Android app cannot access these).
