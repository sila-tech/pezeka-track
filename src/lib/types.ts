export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  avatarUrl: string;
  status: 'Active Loan' | 'Paid Off' | 'Overdue';
};

export type Loan = {
  id: string;
  customerId: string;
  amount: number;
  disbursementDate: string;
  repaymentSchedule: 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'paid' | 'overdue';
  dueDate: string;
  principal: number;
  interest: number;
  customer?: Customer;
};

export type Payment = {
  id: string;
  amount: number;
  paymentDate: string;
  dueDate: string;
};

export type FinanceRecord = {
  id: string;
  type: 'expense' | 'payout' | 'receipt';
  amount: number;
  date: string;
  description: string;
  category: string;
};
