'use client';

import { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfToday, endOfToday, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, FileDown, Loader2, PenSquare, Trash2, Search, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCsv } from '@/lib/excel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface FinanceEntry {
  id: string;
  type: 'expense' | 'payout' | 'receipt' | 'unearned';
  date: { seconds: number; nanoseconds: number } | string | Date;
  amount: number;
  description: string;
  loanId?: string;
  recordedBy?: string;
  expenseCategory?: string;
  receiptCategory?: string;
  payoutCategory?: string;
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
              'w-full sm:w-[260px] justify-start text-left font-normal',
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
  const [searchTerm, setSearchTerm] = useState('');
  const isEditable = !!(onEdit && onDelete);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    
    let filtered = [...entries];

    if (date?.from) {
        filtered = filtered.filter((entry) => {
            let entryDate: Date;
            if (typeof entry.date === 'string') {
                entryDate = new Date(entry.date);
            } else if (entry.date instanceof Date) {
                entryDate = entry.date;
            } else if (entry.date && 'seconds' in entry.date) {
                entryDate = new Date(entry.date.seconds * 1000);
            } else {
                return false;
            }
            
            const fromDate = new Date(date.from!);
            fromDate.setHours(0,0,0,0);

            const toDate = date.to ? new Date(date.to) : new Date(date.from!);
            toDate.setHours(23, 59, 59, 999);

            return entryDate >= fromDate && entryDate <= toDate;
        });
    }

    if (searchTerm) {
        filtered = filtered.filter(entry =>
            (entry.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.expenseCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.receiptCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.payoutCategory || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (entry.recordedBy || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Sort by date descending (Newest first)
    return filtered.sort((a, b) => {
        let dateA = 0;
        let dateB = 0;
        if (typeof a.date === 'string') dateA = new Date(a.date).getTime();
        else if (a.date instanceof Date) dateA = a.date.getTime();
        else if (a.date && 'seconds' in a.date) dateA = a.date.seconds * 1000;

        if (typeof b.date === 'string') dateB = new Date(b.date).getTime();
        else if (b.date instanceof Date) dateB = b.date.getTime();
        else if (b.date && 'seconds' in b.date) dateB = b.date.seconds * 1000;

        return dateB - dateA;
    });
  }, [entries, date, searchTerm]);

  const netTotal = useMemo(() => {
    if (!filteredEntries) return 0;
    return filteredEntries.reduce((acc, entry) => {
        const val = Number(entry.amount) || 0;
        return entry.type === 'receipt' ? acc + val : acc - val;
    }, 0);
  }, [filteredEntries]);

  const handleExport = () => {
    if (filteredEntries) {
      const dataForExport = filteredEntries.map(entry => {
        let entryDate: Date;
        if (typeof entry.date === 'string') {
            entryDate = new Date(entry.date);
        } else if (entry.date instanceof Date) {
            entryDate = entry.date;
        } else if (entry.date && 'seconds' in entry.date) {
            entryDate = new Date(entry.date.seconds * 1000);
        } else {
            entryDate = new Date();
        }

        const record: {[key: string]: any} = {
            'Date': format(entryDate, 'PPP'),
            'Type': entry.type.toUpperCase(),
            'Description': entry.description,
            'Amount (Ksh)': entry.type === 'receipt' ? entry.amount : -entry.amount,
            'Recorded By': entry.recordedBy || 'System'
        };
        const category = entry.expenseCategory || entry.receiptCategory || entry.payoutCategory;
        if (category) record['Category'] = category.replace(/_/g, ' ').toUpperCase();
        
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
            <div className="flex flex-wrap items-center gap-2">
                <DatePickerWithRange date={date} setDate={setDate} />
                <div className="relative">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search entries..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 w-full sm:w-[250px]"
                    />
                </div>
            </div>
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
                <AlertDescription>
                    {searchTerm 
                        ? `No ${title.toLowerCase()} match your search.`
                        : `There are no ${title.toLowerCase()} for the selected period.`
                    }
                </AlertDescription>
            </Alert>
        )}
        {!loading && filteredEntries && filteredEntries.length > 0 && (
          <ScrollArea className="h-[60vh]">
            <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead className="text-right">Amount (Ksh)</TableHead>
                    {isEditable && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
                </TableHeader>
                <TableBody>
                {filteredEntries.map((entry, index) => {
                    let entryDate: Date;
                    if (typeof entry.date === 'string') {
                        entryDate = new Date(entry.date);
                    } else if (entry.date instanceof Date) {
                        entryDate = entry.date;
                    } else if (entry.date && 'seconds' in entry.date) {
                        entryDate = new Date(entry.date.seconds * 1000);
                    } else {
                        entryDate = new Date();
                    }

                    const isInflow = entry.type === 'receipt';

                    return (
                        <TableRow key={`${entry.id}-${index}`}>
                        <TableCell className="text-xs">{format(entryDate, 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                            <div className={cn(
                                "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter",
                                isInflow ? "text-green-600" : "text-destructive"
                            )}>
                                {isInflow ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                                {isInflow ? "In" : "Out"}
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="font-medium text-xs">{entry.description || '-'}</div>
                        </TableCell>
                        <TableCell>
                            {entry.expenseCategory && <Badge variant="secondary" className="text-[9px] bg-orange-100 text-orange-800 border-none">{entry.expenseCategory.replace(/_/g, ' ').toUpperCase()}</Badge>}
                            {entry.receiptCategory && <Badge variant="outline" className="text-[9px] border-green-600 text-green-600">{entry.receiptCategory.replace(/_/g, ' ').toUpperCase()}</Badge>}
                            {entry.payoutCategory && <Badge variant="destructive" className="text-[9px] bg-red-100 text-red-800 border-none">{entry.payoutCategory.replace(/_/g, ' ').toUpperCase()}</Badge>}
                        </TableCell>
                        <TableCell>
                            <span className="text-[10px] italic text-muted-foreground">{entry.recordedBy || 'System'}</span>
                        </TableCell>
                        <TableCell className={cn(
                            "text-right font-black tabular-nums text-sm",
                            isInflow ? "text-green-600" : "text-destructive"
                        )}>
                            {isInflow ? '+' : '-'}{entry.amount.toLocaleString()}
                        </TableCell>
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
                    );
                })}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold bg-muted/50">
                        <TableCell colSpan={5} className="text-right">Net Flow for Period</TableCell>
                        <TableCell className={cn(
                            "text-right font-black",
                            netTotal >= 0 ? "text-green-600" : "text-destructive"
                        )}>
                            Ksh {netTotal.toLocaleString()}
                        </TableCell>
                        {isEditable && <TableCell />}
                    </TableRow>
                </TableFooter>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
