
'use client';

import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { useFirestore, useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Mail, Search, Info, PlusCircle, CheckCircle2, AlertCircle } from 'lucide-react';
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

const mailSchema = z.object({
  recipient: z.string().email('Please enter a valid email.'),
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
  sentAt: { seconds: number; nanoseconds: number } | any;
}

export default function MailPage() {
  const { user, loading: userLoading } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isSending, setIsSending] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingMail, setViewingMail] = useState<MailLog | null>(null);

  const isFinance = user?.role === 'finance' || user?.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2';

  const { data: logs, loading: logsLoading } = useCollection<MailLog>(isFinance ? 'mail_logs' : null);

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

  async function onSendSubmit(values: z.infer<typeof mailSchema>) {
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
  if (!isFinance) return <div className="p-12 text-center">Access Denied. Only Finance users can manage communications.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Mail</h1>
            <p className="text-muted-foreground">Monitor and manage all outgoing communications.</p>
        </div>
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
              <DialogDescription>Send a manual email to any customer or partner via Resend.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSendSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="recipient" render={({ field }) => (
                  <FormItem><FormLabel>Recipient Email</FormLabel><FormControl><Input placeholder="customer@example.com" {...field} /></FormControl><FormMessage /></FormItem>
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
      </div>

      <Card>
        <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-primary" />
                    Sent Communications
                </CardTitle>
                <div className="relative">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search logs..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-8 w-full sm:w-[300px]" 
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground font-medium">No sent items found.</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
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
                            <Button variant="ghost" size="sm" onClick={() => setViewingMail(log)}>View Body</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewingMail} onOpenChange={(open) => !open && setViewingMail(null)}>
          <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                  <DialogTitle>{viewingMail?.subject}</DialogTitle>
                  <DialogDescription>
                      Sent to: <span className="font-bold text-primary">{viewingMail?.recipient}</span>
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
