# Pezeka Credit: Android AI Specification Prompt

Copy and paste the section below into your AI coding assistant (like Cursor, ChatGPT, or Claude) to ensure the Android app integrates perfectly with the Pezeka backend.

---

## CONTEXT
You are building the "Pezeka Credit" Android App. The backend is already configured with specific Firestore Security Rules that protect the integrity of the financial data. If you do not follow the "Security Contract" below, the app will receive a "Missing or insufficient permissions" error.

## THE SECURITY CONTRACT (CRITICAL)
When creating a new loan application in Firestore (`/loans`), the following conditions MUST be met:

1. **Authentication**: The user must be signed in via Firebase Auth.
2. **Path**: Write to `loans/{auto_id}`.
3. **Status**: The `status` field MUST be exactly the string `"application"`.
4. **Identity**: The `customerId` field MUST match `request.auth.uid`.
5. **Whitelist**: You can ONLY send these fields. Sending others (like `interestRate`) will result in a 403 error:
   - `principalAmount` (Number)
   - `tenureMonths` (Number)
   - `idNumber` (String)
   - `customerName` (String)
   - `customerPhone` (String)
   - `nextOfKinName` (String)
   - `nextOfKinPhone` (String)
   - `paymentMethod` (String - e.g., "MPESA")
   - `accountNumber` (String - The target for funds)
   - `customerId` (String - The User's UID)
   - `status` (String - MUST be "application")
   - `createdAt` (Timestamp - use `FieldValue.serverTimestamp()`)

## REPAYMENT LOGIC (For the UI Calculator)
- **Quick Pesa**: 10% Interest per month.
- **Business Loan**: 5% Interest per month.
- **Calculation**: `Total Repayable = Principal + (Principal * MonthlyRate * Tenure)`.
- **Note**: The backend AI handles the final confirmation of interest; the Android app simply displays the estimate and submits the request.

## TASKS
1. Implement a `LoanApplicationViewModel` that handles the state of the form.
2. Create a Compose/XML layout for the application form.
3. Implement the `submitApplication` function using the Firebase Firestore SDK, ensuring strict adherence to the field whitelist and status string.
4. Implement a "My Loans" list that queries: `db.collection("loans").whereEqualTo("customerId", currentUid)`.

---
