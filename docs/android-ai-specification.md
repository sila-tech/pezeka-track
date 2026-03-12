# Pezeka Credit: Android AI Specification Prompt

Copy and paste the section below into your AI coding assistant (like Cursor, ChatGPT, or Claude) to ensure the Android app integrates perfectly with the Pezeka backend.

---

## CONTEXT
You are building the "Pezeka Credit" Android App. The backend is already configured with specific Firestore Security Rules that protect the integrity of the financial data. 

## THE SECURITY CONTRACT (CRITICAL)
When creating a new loan application in Firestore (`/loans`), the following conditions MUST be met:

1. **Authentication**: The user must be signed in via Firebase Auth before any write.
2. **Path**: Write to `loans/{auto_id}`.
3. **Identity**: The `customerId` field MUST be included and MUST match `request.auth.uid`.
4. **Status**: The `status` field MUST be included and MUST be exactly the string `"application"`.
5. **Data Payload**: Ensure you send these core fields:
   - `principalAmount` (Number)
   - `tenureMonths` (Number)
   - `idNumber` (String)
   - `customerName` (String)
   - `customerPhone` (String)
   - `paymentMethod` (String - e.g., "MPESA")
   - `accountNumber` (String - The target for funds)
   - `customerId` (String - The User's UID)
   - `status` (String - "application")
   - `createdAt` (Timestamp - use `FieldValue.serverTimestamp()`)

## REPAYMENT LOGIC (For UI Calculator)
- **Quick Pesa**: 10% Interest per month.
- **Business Loan**: 5% Interest per month.
- **Formula**: `Total Repayable = Principal + (Principal * MonthlyRate * Tenure)`.

## TASKS
1. Ensure the user is logged in before showing the "Apply" button.
2. Construct the loan map ensuring `customerId` and `status: "application"` are present.
3. Submit via `FirebaseFirestore.getInstance().collection("loans").add(loanMap)`.
4. Handle the success/failure listeners.

---