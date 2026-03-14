'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Mail, Search, Info, PlusCircle, CheckCircle2, Inbox, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { sendManualEmail } from '@/app/actions/email-actions';
import { addMailLog } from '@/lib/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const mailSchema = z.object({
  recipient: z.string().email('Please select a valid customer.'),
  subject: z.string().min(1, 'Subject is required.'),
  body: z.string().min(1, 'Message body is required.'),
});

interface MailLog {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  type: string;
  sender: string;
  direction?: 'inbound' | 'outbound';
  sentAt: { seconds: number; nanoseconds: number } | any;
}

interface Customer {
    id: string;
    name: string;
    email?: string;
}

export default function MailPage() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isSending, setIsSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingMail, setViewingMail] = useState<MailLog | null>(null);

  // Now accessible to all authorized admin team members (Staff, Finance, Admin)
  const isAuthorized = user?.role === 'staff' || user?.role === 'finance' || user?.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';
  // But strictly limit who can actually SEND manual outreach
  const canSend = user?.role === 'finance' || user?.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';

  const { data: logs, loading: logsLoading } = useCollection<MailLog>(isAuthorized ? 'mail_logs' : null);
  const { data: customers } = useCollection<Customer>('customers');

  const customersWithEmail = useMemo(() => {
      return (customers || []).filter(c => !!c.email);
  }, [customers]);

  const form = useForm<z.infer<typeof mailSchema>>({
    resolver: zodResolver(mailSchema),
    defaultValues: { recipient: '', subject: '', body: '' },
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs
      .filter(log => 
        log.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.type.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
          const t1 = a.sentAt?.seconds || 0;
          const t2 = b.sentAt?.seconds || 0;
          return t2 - t1;
      });
  }, [logs, searchTerm]);

  const sentLogs = useMemo(() => filteredLogs.filter(l => l.direction !== 'inbound'), [filteredLogs]);
  const inboundLogs = useMemo(() => filteredLogs.filter(l => l.direction === 'inbound'), [filteredLogs]);

  async function onSendSubmit(values: z.infer<typeof mailSchema>) {
    if (!canSend) return;
    setIsSending(true);
    try {
      const result = await sendManualEmail(values);
      if (result.success) {
        await addMailLog(firestore, {
            ...values,
            type: 'manual_outreach',
            sender: user?.name || user?.email || 'Staff'
        });
        toast({ title: 'Email Sent', description: `Message successfully delivered to ${values.recipient}.` });
        form.reset();
        setComposeOpen(false);
      } else {
        throw new Error('Resend API failed to deliver the message.');
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Send Failed', description: error.message });
    } finally {
      setIsSending(false);
    }
  }

  if (userLoading || logsLoading) return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!isAuthorized) return <div className="p-12 text-center">Access Denied.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Mail</h1>
            <p className="text-muted-foreground">Monitor and manage all customer communications.</p>
        </div>
        {canSend && (
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 px-6 font-bold shadow-md">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  New Email
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Compose Outreach Email</DialogTitle>
                <DialogDescription>Select a customer to send a manual message via Resend.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSendSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="recipient" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipient Customer</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select a customer with email" />
                              </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                              {customersWithEmail.map(customer => (
                                  <SelectItem key={customer.id} value={customer.email!}>
                                      {customer.name} ({customer.email})
                                  </SelectItem>
                              ))}
                              {customersWithEmail.length === 0 && (
                                  <SelectItem value="none" disabled>No customers with emails found</SelectItem>
                              )}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}/>
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="Re: Loan Status Update" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="body" render={({ field }) => (
                    <FormItem><FormLabel>Message Body</FormLabel><FormControl><Textarea className="min-h-[200px]" placeholder="Type your message here..." {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <DialogFooter className="pt-4">
                    <Button type="submit" disabled={isSending} className="w-full sm:w-auto h-11 px-8">
                      {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Send Email Now
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="sent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <TabsList>
                <TabsTrigger value="sent" className="gap-2">
                    <ArrowUpRight className="h-4 w-4" />
                    Sent ({sentLogs.length})
                </TabsTrigger>
                <TabsTrigger value="inbound" className="gap-2">
                    <ArrowDownLeft className="h-4 w-4" />
                    Inbound ({inboundLogs.length})
                </TabsTrigger>
            </TabsList>
            <div className="relative">
                <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search messages..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-8 w-full sm:w-[300px]" 
                />
            </div>
        </div>

        <TabsContent value="sent" className="m-0">
            <Card>
                <CardHeader>
                    <CardTitle>Sent Communications</CardTitle>
                    <CardDescription>History of outreach and automated notifications.</CardDescription>
                </CardHeader>
                <CardContent>
                    <MailList logs={sentLogs} onSelect={setViewingMail} />
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="inbound" className="m-0">
            <Card>
                <CardHeader>
                    <CardTitle>Incoming Messages</CardTitle>
                    <CardDescription>Customer replies and new inquiries.</CardDescription>
                </CardHeader>
                <CardContent>
                    {inboundLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Inbox className="h-12 w-12 text-muted-foreground/20 mb-4" />
                            <p className="text-muted-foreground font-medium">No incoming messages yet.</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                                To receive emails directly here, configure your MX records to point to your inbound webhook.
                            </p>
                        </div>
                    ) : (
                        <MailList logs={inboundLogs} onSelect={setViewingMail} />
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewingMail} onOpenChange={(open) => !open && setViewingMail(null)}>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                  <DialogTitle>{viewingMail?.subject}</DialogTitle>
                  <DialogDescription>
                      {viewingMail?.direction === 'inbound' ? 'From: ' : 'To: '}
                      <span className="font-bold text-primary">{viewingMail?.recipient}</span>
                  </DialogDescription>
              </DialogHeader>
              <ScrollArea className="mt-4 h-[400px] border rounded-lg p-6 bg-muted/30">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                      {viewingMail?.body}
                  </pre>
              </ScrollArea>
              <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}

function MailList({ logs, onSelect }: { logs: MailLog[], onSelect: (log: MailLog) => void }) {
    return (
        <ScrollArea className="h-[60vh]">
            <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Recipient/Sender</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Origin</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logs.map((log) => {
                        const sentDate = log.sentAt?.seconds ? new Date(log.sentAt.seconds * 1000) : new Date();
                        return (
                            <TableRow key={log.id}>
                                <TableCell className="text-xs">{format(sentDate, 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell className="font-medium text-xs">{log.recipient}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight">
                                        {log.type.replace(/_/g, ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        {log.sender === 'AI Automation' ? <CheckCircle2 className="h-3 w-3 text-primary" /> : <Info className="h-3 w-3 text-muted-foreground" />}
                                        {log.sender}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => onSelect(log)}>View Body</Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
