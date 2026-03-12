# Pezeka Credit: Android Integration Guide

This guide outlines how the Android application should interact with the Firebase backend to ensure compliance with Security Rules and provide a seamless user experience.

## 1. Authentication (CRITICAL)
*   **Method**: Use Firebase Authentication (Email/Password or Phone).
*   **Identity**: The user's `UID` is the primary key used to secure data.
*   **Check**: You **MUST** ensure `FirebaseAuth.getInstance().getCurrentUser() != null` before writing to Firestore.

## 2. Recommended Seamless Application Flow
To provide the best user experience, follow this 5-step process:

1.  **Product Selection**: Show cards for "Quick Pesa," "Business Loan," etc.
2.  **Repayment Calculator**: Allow users to toggle amount/tenure and see the estimated installment.
3.  **Profile Auto-Fill**: Fetch the document at `/customers/{UID}`. If it exists, pre-fill the name and phone fields.
4.  **Application Form**: Collect the `idNumber`, `nextOfKinName`, and `accountNumber` (Destination for funds).
5.  **Status Tracking**: After submission, redirect the user to a list view of their loans filtered by their `customerId`.

## 3. Loan Applications (`/loans`)
The Android app is restricted to **Creating Applications** and **Reading Own Loans**.

### Allowed Fields Whitelist (STRICT)
To prevent "Insufficient Permissions," your Firestore `set()` or `add()` call **MUST ONLY** include these fields. Sending others (like `interestRate`) will result in a permission error.

| Field | Type | Description |
| :--- | :--- | :--- |
| `customerId` | String | Must match `Firebase.auth.currentUser.uid` |
| `status` | String | Must be exactly `"application"` |
| `principalAmount`| Number | The requested loan amount |
| `tenureMonths` | Number | Duration of the loan |
| `idNumber` | String | National ID of the customer |
| `customerName` | String | Full name |
| `customerPhone` | String | Primary contact |
| `nextOfKinName` | String | Emergency contact name |
| `nextOfKinPhone` | String | Emergency contact phone |
| `paymentMethod` | String | e.g., "MPESA" or "BANK" |
| `accountNumber` | String | Where the user wants to receive funds |
| `createdAt` | Timestamp | `FieldValue.serverTimestamp()` |

### Kotlin Example: Submitting an Application
```kotlin
val loanApp = hashMapOf(
    "customerId" to Firebase.auth.currentUser?.uid,
    "status" to "application",
    "principalAmount" to 5000,
    "tenureMonths" to 1,
    "idNumber" to "12345678",
    "customerName" to "John Doe",
    "customerPhone" to "0712345678",
    "nextOfKinName" to "Jane Doe",
    "nextOfKinPhone" to "0787654321",
    "paymentMethod" to "MPESA",
    "accountNumber" to "0712345678",
    "createdAt" to FieldValue.serverTimestamp()
)

db.collection("loans").add(loanApp)
    .addOnSuccessListener { /* Show Success UI */ }
    .addOnFailureListener { e -> /* Log Error */ }
```

## 4. Querying Loan History
You **cannot** call `.get()` on the whole collection. You MUST use a filter to prove ownership:
`db.collection("loans").whereEqualTo("customerId", currentUid).get()`

## 5. System Metadata (`/system_config/app_metadata`)
This document is publicly readable. Use it to store:
*   `min_version`: To force app updates.
*   `maintenance_mode`: Boolean to disable the app during server work.

## 6. Financial Definitions
*   **Total Repayable (Amt to Pay)**: `Principal + Interest + Penalties`.
*   **Outstanding Balance**: `Total Repayable - Total Paid`.
*   **Disbursed Amt**: `Principal - Upfront Fees`. (Calculated by Finance during approval).
