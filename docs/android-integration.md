# Pezeka Credit: Android Integration Guide

This guide outlines how the Android application should interact with the Firebase backend to ensure compliance with Security Rules and avoid permission errors.

## 1. Authentication (CRITICAL)
*   **Method**: Use Firebase Authentication (Email/Password or Phone).
*   **Identity**: The user's `UID` is the primary key used to secure data.
*   **Check**: You **MUST** ensure `FirebaseAuth.getInstance().getCurrentUser() != null` before writing to Firestore.

## 2. Customer Profile (`/customers/{uid}`)
*   **Read**: The app can read the document at `/customers/YOUR_UID`.
*   **Write**: The app can create or update this document.
*   **Important Fields**:
    *   `name`: Full name.
    *   `phone`: Primary contact.
    *   `idNumber`: National ID.
    *   `accountNumber`: (Read-only) Assigned by Admin.

## 3. Loan Applications (`/loans` or `/loan_applications`)
The Android app is restricted to **Creating Applications** and **Reading Own Loans**.

### Allowed Fields Whitelist (STRICT)
To prevent "Insufficient Permissions," you must **ONLY** send these fields. Injecting other fields (like `totalPaid` in a new application) will cause a crash.

1.  `customerId`: String (Must match current Auth UID).
2.  `status`: String (Must be exactly `"application"` - case insensitive).
3.  `amount`: Number (Principal requested).
4.  `tenureMonths`: Number.
5.  `idNumber`: String.
6.  `customerName`: String.
7.  `customerPhone`: String.
8.  `nextOfKinName`: String.
9.  `nextOfKinPhone`: String.
10. `paymentMethod`: String.
11. `accountNumber`: String (Destination for funds).
12. `createdAt`: Timestamp.

### Querying Loan History
*   **Requirement**: You **cannot** call `.get()` on the whole collection. You MUST use a filter:
    `db.collection("loans").whereEqualTo("customerId", currentUid).get()`

## 4. System Metadata (`/system_config/app_metadata`)
*   This document is publicly readable.
*   Use it to store app version info, maintenance alerts, or bank details.

## 5. Troubleshooting "Permission Denied"
1.  **Check Auth**: Is the user logged in?
2.  **Check Status**: Are you sending `status: "application"`?
3.  **Check Fields**: Are you sending a field NOT in the whitelist (e.g., `interestRate`)?
4.  **Check Collection**: Ensure you are writing to `loans` or `loan_applications`.

## 6. Financial Definitions
*   **Total Repayable (Amt to Pay)**: `Principal + Interest + Penalties`.
*   **Outstanding Balance**: `Total Repayable - Total Paid`.
*   **Disbursed Amt**: `Principal - Upfront Fees`.