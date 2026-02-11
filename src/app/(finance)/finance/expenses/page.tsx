import { financeRecords } from "@/lib/data";
import { FinanceDataTable } from "../data-table";

export default function ExpensesPage() {
  const expenseRecords = financeRecords.filter(r => r.type === 'expense');
  return <FinanceDataTable title="Daily Expenses" records={expenseRecords} type="expense" />;
}
