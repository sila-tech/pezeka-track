'use client';

import { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfToday, endOfToday, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, FileDown, Loader2, PenSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/excel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface FinanceEntry {
  id: string;
  type: 'expense' | 'payout' | 'receipt' | 'unearned';
  date: { seconds: number; nanoseconds: number } | string;
  amount: number;
  description: string;
  transactionCost?: number;
  loanId?: string;
}

interface FinanceReportTabProps {
  title: string;
  description: string;
  entries: FinanceEntry[] | null;
  loading: boolean;
  onEdit?: (entry: FinanceEntry) => void;
  onDelete?: (entry: FinanceEntry) => void;
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
}: {
  className?: string;
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
}) {
  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full sm:w-[300px] justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'LLL dd, y')} -{' '}
                  {format(date.to, 'LLL dd, y')}
                </>
              ) : (
                format(date.from, 'LLL dd, y')
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={setDate}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}


export function EditableFinanceReportTab({ title, description, entries, loading, onEdit, onDelete }: FinanceReportTabProps) {
  const [date, setDate] = useState<DateRange | undefined>();
  const showTransactionCost = useMemo(() => title === 'Payouts' || title === 'Expenses', [title]);
  const isEditable = !!(onEdit && onDelete);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    if (!date?.from) return entries;

    return entries.filter((entry) => {
      const entryDate = typeof entry.date === 'string' ? new Date(entry.date) : new Date(entry.date.seconds * 1000);
      
      const fromDate = new Date(date.from!);
      fromDate.setHours(0,0,0,0);

      const toDate = date.to ? new Date(date.to) : new Date(date.from!);
      toDate.setHours(23, 59, 59, 999);

      return entryDate >= fromDate && entryDate <= toDate;
    });
  }, [entries, date]);

  const { totalAmount, totalTransactionCost } = useMemo(() => {
    if (!filteredEntries) return { totalAmount: 0, totalTransactionCost: 0 };
    return filteredEntries.reduce((acc, entry) => {
        acc.totalAmount += entry.amount;
        acc.totalTransactionCost += entry.transactionCost || 0;
        return acc;
    }, { totalAmount: 0, totalTransactionCost: 0 });
  }, [filteredEntries]);

  const grandTotal = totalAmount + totalTransactionCost;

  const handleExport = () => {
    if (filteredEntries) {
      const dataForExport = filteredEntries.map(entry => {
        const record: {[key: string]: any} = {
            'Date': format(typeof entry.date === 'string' ? new Date(entry.date) : new Date(entry.date.seconds * 1000), 'PPP'),
            'Description': entry.description,
            'Amount (Ksh)': entry.amount,
        };
        if(showTransactionCost) {
            record['Transaction Cost (Ksh)'] = entry.transactionCost || 0;
            record['Total (Ksh)'] = entry.amount + (entry.transactionCost || 0);
        }
        return record;
      });
      exportToCsv(dataForExport, `${title.toLowerCase().replace(/ /g, '_')}_report`);
    }
  };
  
  const setDatePreset = (preset: 'today' | 'weekly' | 'monthly' | 'all') => {
      const today = new Date();
      if (preset === 'all') {
        setDate(undefined);
      } else if (preset === 'today') {
          setDate({ from: startOfToday(), to: endOfToday() });
      } else if (preset === 'weekly') {
          setDate({ from: startOfWeek(today), to: endOfWeek(today) });
      } else if (preset === 'monthly') {
          setDate({ from: startOfMonth(today), to: endOfMonth(today) });
      }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                 <Button variant="outline" onClick={() => setDatePreset('all')}>All Time</Button>
                 <Button variant="outline" onClick={() => setDatePreset('today')}>Today</Button>
                 <Button variant="outline" onClick={() => setDatePreset('weekly')}>This Week</Button>
                 <Button variant="outline" onClick={() => setDatePreset('monthly')}>This Month</Button>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
            <DatePickerWithRange date={date} setDate={setDate} />
            <Button onClick={handleExport} disabled={!filteredEntries || filteredEntries.length === 0}>
                <FileDown className="mr-2 h-4 w-4" />
                Download CSV
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && (!filteredEntries || filteredEntries.length === 0) && (
            <Alert>
                <AlertTitle>No Entries Found</AlertTitle>
                <AlertDescription>There are no {title.toLowerCase()} for the selected period.</AlertDescription>
            </Alert>
        )}
        {!loading && filteredEntries && filteredEntries.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount (Ksh)</TableHead>
                {showTransactionCost && <TableHead className="text-right">Transaction Cost (Ksh)</TableHead>}
                {showTransactionCost && <TableHead className="text-right">Total (Ksh)</TableHead>}
                {isEditable && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{format(typeof entry.date === 'string' ? new Date(entry.date) : new Date(entry.date.seconds * 1000), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="font-medium">{entry.description || '-'}</TableCell>
                  <TableCell className="text-right">{entry.amount.toLocaleString()}</TableCell>
                  {showTransactionCost && <TableCell className="text-right">{(entry.transactionCost || 0).toLocaleString()}</TableCell>}
                  {showTransactionCost && <TableCell className="text-right">{(entry.amount + (entry.transactionCost || 0)).toLocaleString()}</TableCell>}
                  {isEditable && onEdit && onDelete && (
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
                           <PenSquare className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(entry)}>
                           <Trash2 className="h-4 w-4" />
                       </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
                <TableRow className="font-bold bg-muted/50">
                    <TableCell colSpan={2} className="text-right">Total</TableCell>
                     {showTransactionCost ? (
                        <>
                            <TableCell className="text-right">{totalAmount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{totalTransactionCost.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{grandTotal.toLocaleString()}</TableCell>
                        </>
                    ) : (
                         <TableCell className="text-right">{grandTotal.toLocaleString()}</TableCell>
                    )}
                    {isEditable && <TableCell />}
                </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
