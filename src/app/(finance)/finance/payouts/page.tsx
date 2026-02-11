"use client";

import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { FinanceDataTable } from "../data-table";
import { FinanceRecord } from "@/lib/types";

export default function PayoutsPage() {
  const firestore = useFirestore();
  const payoutRecordsQuery = useMemoFirebase(
    () => query(collection(firestore, "financialRecords"), where("type", "==", "payout")),
    [firestore]
  );
  const { data: payoutRecords, isLoading } = useCollection<FinanceRecord>(payoutRecordsQuery);

  if (isLoading) {
    return <main className="flex-1 space-y-4 p-4 md:p-8 pt-6">Loading...</main>;
  }
  
  return <FinanceDataTable title="Daily Payouts" records={payoutRecords || []} type="payout" />;
}
