
'use client';

import { useMemo, useState } from 'react';
import { useAppUser, useCollection, useFirestore } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Users, 
    Share2, 
    Copy, 
    CheckCircle2, 
    Clock, 
    Wallet, 
    TrendingUp, 
    ExternalLink,
    Send,
    ShieldCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Referral {
    id: string;
    referrerId: string;
    refereeName: string;
    status: 'signed_up' | 'applied' | 'disbursed';
    verified?: boolean;
    timestamp: { seconds: number, nanoseconds: number } | any;
}

export default function AgentDashboard() {
  const { user } = useAppUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const { data: referrals, loading } = useCollection<Referral>(user ? 'referrals' : null);

  const myReferrals = useMemo(() => {
      if (!referrals || !user) return [];
      return referrals.filter(r => r.referrerId === user.uid).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
  }, [referrals, user]);

  const stats = useMemo(() => {
      return {
          total: myReferrals.length,
          converted: myReferrals.filter(r => r.status === 'disbursed').length,
          verified: myReferrals.filter(r => r.verified).length,
      };
  }, [myReferrals]);

  const referralLink = useMemo(() => {
      if (!user?.referralCode) return '';
      const base = typeof window !== 'undefined' ? window.location.origin : 'https://pezeka.com';
      return `${base}/customer-login?ref=${user.referralCode}`;
  }, [user?.referralCode]);

  const copyLink = () => {
      navigator.clipboard.writeText(referralLink);
      toast({ title: 'Link Copied', description: 'Your referral link is ready to share!' });
  };

  const shareToWhatsApp = () => {
      const message = `Hello! I recommend Pezeka Credit for fast and reliable loans. Sign up using my link: ${referralLink}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-8">
      {/* Welcome & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
              <h1 className="text-3xl font-black text-[#1B2B33]">Overview</h1>
              <p className="text-muted-foreground">Track your performance and invite new clients.</p>
          </div>
          <div className="bg-[#1B2B33] text-white p-6 rounded-[2rem] flex items-center gap-6 shadow-xl shadow-navy-900/10">
              <div className="text-center">
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Total Referrals</p>
                  <p className="text-2xl font-black">{stats.total}</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="text-center">
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Verified Earnings</p>
                  <p className="text-2xl font-black text-green-400">{stats.verified}</p>
              </div>
          </div>
      </div>

      {/* Referral Link Action Card */}
      <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <div className="bg-[#5BA9D0] p-8 text-white">
              <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                      <Share2 className="h-6 w-6 text-white" />
                  </div>
                  <h2 className="text-2xl font-black">Your Referral Link</h2>
              </div>
              <p className="text-white/80 font-medium mb-6">Invite business owners and individuals to Pezeka. When they take their first loan and it's verified, you'll earn your commission.</p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 bg-white/10 border border-white/20 rounded-2xl p-4 font-mono text-sm break-all flex items-center justify-between group">
                      <span className="truncate">{referralLink || 'Generating...'}</span>
                      <button onClick={copyLink} className="ml-2 p-2 hover:bg-white/20 rounded-xl transition-colors">
                          <Copy className="h-4 w-4" />
                      </button>
                  </div>
                  <Button onClick={shareToWhatsApp} className="h-full bg-white text-[#5BA9D0] hover:bg-white/90 font-black px-8 py-4 rounded-2xl shadow-lg flex gap-2">
                      <Send className="h-5 w-5" />
                      Share to WhatsApp
                  </Button>
              </div>
          </div>
      </Card>

      {/* Referrals List */}
      <div className="grid gap-6">
          <h2 className="text-xl font-black text-[#1B2B33] flex items-center gap-2">
              <Users className="h-5 w-5 text-[#5BA9D0]" />
              Recent Referrals
          </h2>
          
          <Card className="rounded-[2rem] border-none shadow-lg overflow-hidden">
              <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                      {myReferrals.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                  <Users className="h-8 w-8 text-muted-foreground/40" />
                              </div>
                              <p className="font-bold text-[#1B2B33]">No referrals yet</p>
                              <p className="text-sm text-muted-foreground mt-1 max-w-xs">Share your unique link to start building your network and earning commissions.</p>
                          </div>
                      ) : (
                          <Table>
                              <TableHeader className="bg-muted/30">
                                  <TableRow>
                                      <TableHead className="font-bold text-[#1B2B33]">Customer Name</TableHead>
                                      <TableHead className="font-bold text-[#1B2B33]">Status</TableHead>
                                      <TableHead className="font-bold text-[#1B2B33]">Verification</TableHead>
                                      <TableHead className="text-right font-bold text-[#1B2B33]">Date</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {myReferrals.map((ref) => {
                                      const date = ref.timestamp?.seconds ? new Date(ref.timestamp.seconds * 1000) : new Date();
                                      return (
                                          <TableRow key={ref.id}>
                                              <TableCell className="font-medium">{ref.refereeName}</TableCell>
                                              <TableCell>
                                                  <Badge variant={ref.status === 'disbursed' ? 'default' : 'secondary'} className="rounded-lg px-2 py-1 uppercase text-[9px] font-black">
                                                      {ref.status.replace('_', ' ')}
                                                  </Badge>
                                              </TableCell>
                                              <TableCell>
                                                  {ref.verified ? (
                                                      <div className="flex items-center gap-1 text-green-600 text-[10px] font-bold uppercase">
                                                          <ShieldCheck className="h-3 w-3" />
                                                          Verified
                                                      </div>
                                                  ) : (
                                                      <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-bold uppercase">
                                                          <Clock className="h-3 w-3" />
                                                          Pending
                                                      </div>
                                                  )}
                                              </TableCell>
                                              <TableCell className="text-right text-[10px] text-muted-foreground font-bold">
                                                  {format(date, 'dd MMM yyyy')}
                                              </TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                      )}
                  </ScrollArea>
              </CardContent>
          </Card>
      </div>

      {/* Commission Guide */}
      <div className="bg-[#1B2B33]/5 border border-[#1B2B33]/10 rounded-[2rem] p-8">
          <div className="flex items-start gap-4">
              <TrendingUp className="h-6 w-6 text-[#1B2B33] mt-1" />
              <div className="space-y-2">
                  <h3 className="font-black text-[#1B2B33]">Commission Structure</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                      Commissions are processed once your referral's first loan is disbursed and **verified** by the finance team. Payouts are made to your registered contact number.
                  </p>
              </div>
          </div>
      </div>
    </div>
  );
}
