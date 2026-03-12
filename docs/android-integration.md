# Pezeka Credit: Android Integration Guide

This guide outlines how the Android application should interact with the Firebase backend to avoid "Insufficient Permissions" errors.

## 1. Authentication (MANDATORY)
*   **Method**: Users MUST be logged in via Firebase Auth.
*   **Check**: Verify `FirebaseAuth.getInstance().getCurrentUser() != null` before calling Firestore.
*   **Rules**: The database blocks any write where `request.auth` is null.

## 2. The Loan Submission "Contract"
To prevent `PERMISSION_DENIED`, your `collection("loans").add()` call MUST include:

| Field | Type | Required Value |
| :--- | :--- | :--- |
| `customerId` | String | Must match `Firebase.auth.currentUser.uid` |
| `status` | String | Must be exactly `"application"` |
| `principalAmount`| Number | The requested loan amount |
| `createdAt` | Timestamp | `FieldValue.serverTimestamp()` |

### Kotlin Example
```kotlin
val loanApp = hashMapOf(
    "customerId" to Firebase.auth.currentUser?.uid,
    "status" to "application",
    "principalAmount" to 2000,
    "tenureMonths" to 1,
    "idNumber" to "37106875",
    "customerName" to "John Doe",
    "customerPhone" to "0741557960",
    "paymentMethod" to "MPESA",
    "accountNumber" to "0741557960",
    "createdAt" to FieldValue.serverTimestamp()
)

db.collection("loans").add(loanApp)
    .addOnSuccessListener { /* Success */ }
    .addOnFailureListener { e -> Log.e("Pezeka", "Error: ${e.message}") }
```

## 3. Querying Data
You cannot download the entire `loans` collection. You MUST filter by your own ID:
`db.collection("loans").whereEqualTo("customerId", currentUid).get()`

## 4. Troubleshooting Permission Denied
If you still see "Missing or insufficient permissions":
1. **Login State**: Ensure the user didn't get logged out.
2. **Field Names**: Check that `customerId` is spelled correctly (case-sensitive).
3. **Status Value**: Ensure `status` is exactly `"application"`.
4. **Collection Name**: Ensure you are writing to `"loans"` (plural).
