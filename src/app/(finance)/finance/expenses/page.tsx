"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { FinanceDataTable } from "../data-table";
import { FinanceRecord } from "@/lib/types";

export default function ExpensesPage() {
  const firestore = useFirestore();
  const expenseRecordsQuery = useMemoFirebase(
    () => query(collection(firestore, "financialRecords"), where("type", "==", "expense")),
    [firestore]
  );
  const { data: expenseRecords, isLoading } = useCollection<FinanceRecord>(expenseRecordsQuery);

  if (isLoading) {
    return <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">Loading...</main>;
  }

  return <FinanceDataTable title="Daily Expenses" records={expenseRecords || []} type="expense" />;
}
