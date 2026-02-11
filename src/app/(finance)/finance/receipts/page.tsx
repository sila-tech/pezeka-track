import { financeRecords } from "@/lib/data";
import { FinanceDataTable } from "../data-table";

export default function ReceiptsPage() {
  const receiptRecords = financeRecords.filter(r => r.type === 'receipt');
  return <FinanceDataTable title="Daily Receipts" records={receiptRecords} type="receipt" />;
}
