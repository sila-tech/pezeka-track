import { financeRecords } from "@/lib/data";
import { FinanceDataTable } from "../data-table";

export default function PayoutsPage() {
  const payoutRecords = financeRecords.filter(r => r.type === 'payout');
  return <FinanceDataTable title="Daily Payouts" records={payoutRecords} type="payout" />;
}
