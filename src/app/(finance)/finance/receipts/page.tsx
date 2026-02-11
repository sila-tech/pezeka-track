"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { FinanceDataTable } from "../data-table";
import { FinanceRecord } from "@/lib/types";

export default function ReceiptsPage() {
  const firestore = useFirestore();
  const receiptRecordsQuery = useMemoFirebase(
    () => query(collection(firestore, "financialRecords"), where("type", "==", "receipt")),
    [firestore]
  );
  const { data: receiptRecords, isLoading } = useCollection<FinanceRecord>(receiptRecordsQuery);

  if (isLoading) {
    return <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">Loading...</main>;
  }

  return <FinanceDataTable title="Daily Receipts" records={receiptRecords || []} type="receipt" />;
}
