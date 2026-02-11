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
  payments: Payment[];
  principal: number;
  interest: number;
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

export const customers: Customer[] = [
  { id: 'CUST-001', name: 'Alice Johnson', email: 'alice@example.com', phone: '555-0101', joinDate: '2023-01-15', avatarUrl: 'https://picsum.photos/seed/user-1/100/100', status: 'Overdue' },
  { id: 'CUST-002', name: 'Bob Williams', email: 'bob@example.com', phone: '555-0102', joinDate: '2023-02-20', avatarUrl: 'https://picsum.photos/seed/user-2/100/100', status: 'Active Loan' },
  { id: 'CUST-003', name: 'Charlie Brown', email: 'charlie@example.com', phone: '555-0103', joinDate: '2023-03-10', avatarUrl: 'https://picsum.photos/seed/user-3/100/100', status: 'Paid Off' },
  { id: 'CUST-004', name: 'Diana Miller', email: 'diana@example.com', phone: '555-0104', joinDate: '2023-04-05', avatarUrl: 'https://picsum.photos/seed/user-4/100/100', status: 'Active Loan' },
  { id: 'CUST-005', name: 'Ethan Davis', email: 'ethan@example.com', phone: '555-0105', joinDate: '2023-05-12', avatarUrl: 'https://picsum.photos/seed/user-5/100/100', status: 'Active Loan' },
];

export const loans: Loan[] = [
  {
    id: 'LOAN-001',
    customerId: 'CUST-001',
    amount: 5000,
    disbursementDate: '2024-05-01',
    repaymentSchedule: 'monthly',
    status: 'overdue',
    dueDate: '2024-06-01',
    principal: 5000,
    interest: 500,
    payments: [
      { id: 'PAY-001', amount: 0, paymentDate: '', dueDate: '2024-06-01' },
    ],
  },
  {
    id: 'LOAN-002',
    customerId: 'CUST-002',
    amount: 1000,
    disbursementDate: '2024-06-15',
    repaymentSchedule: 'weekly',
    status: 'active',
    dueDate: '2024-06-22',
    principal: 1000,
    interest: 100,
    payments: [],
  },
  {
    id: 'LOAN-003',
    customerId: 'CUST-003',
    amount: 2500,
    disbursementDate: '2024-01-20',
    repaymentSchedule: 'monthly',
    status: 'paid',
    dueDate: '2024-02-20',
    principal: 2500,
    interest: 250,
    payments: [
      { id: 'PAY-002', amount: 2750, paymentDate: '2024-02-18', dueDate: '2024-02-20' },
    ],
  },
    {
    id: 'LOAN-004',
    customerId: 'CUST-004',
    amount: 750,
    disbursementDate: '2024-06-25',
    repaymentSchedule: 'daily',
    status: 'active',
    dueDate: '2024-06-26',
    principal: 750,
    interest: 50,
    payments: [],
  },
    {
    id: 'LOAN-005',
    customerId: 'CUST-005',
    amount: 10000,
    disbursementDate: '2024-06-10',
    repaymentSchedule: 'monthly',
    status: 'active',
    dueDate: '2024-07-10',
    principal: 10000,
    interest: 1200,
    payments: [],
  },
];

export const financeRecords: FinanceRecord[] = [
  { id: 'FIN-001', type: 'receipt', amount: 2750, date: '2024-02-18', description: 'Payment for LOAN-003', category: 'Loan Repayment' },
  { id: 'FIN-002', type: 'payout', amount: 5000, date: '2024-05-01', description: 'Disbursement for LOAN-001', category: 'Loan Disbursement' },
  { id: 'FIN-003', type: 'payout', amount: 1000, date: '2024-06-15', description: 'Disbursement for LOAN-002', category: 'Loan Disbursement' },
  { id: 'FIN-004', type: 'expense', amount: 150, date: '2024-06-20', description: 'Office Supplies', category: 'Office Expenses' },
  { id: 'FIN-005', type: 'payout', amount: 750, date: '2024-06-25', description: 'Disbursement for LOAN-004', category: 'Loan Disbursement' },
  { id: 'FIN-006', type: 'receipt', amount: 50, date: '2024-06-26', description: 'Partial payment for LOAN-004', category: 'Loan Repayment' },
  { id: 'FIN-007', type: 'expense', amount: 200, date: '2024-06-27', description: 'Travel facilitation', category: 'Facilitation' },
  { id: 'FIN-008', type: 'payout', amount: 10000, date: '2024-06-10', description: 'Disbursement for LOAN-005', category: 'Loan Disbursement' },
];
