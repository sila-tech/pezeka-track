
'use client';

import { useMemo, useState } from 'react';
import { useCollection, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Share2, Users, Loader2, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

interface Customer {
    id: string;
    name: string;
    phone: string;
    referralCode?: string;
    referredBy?: string;
    createdAt?: any;
}

export default function AdminReferralsPage() {
    const { user, loading: userLoading } = useAppUser();
    const [searchTerm, setSearchTerm] = useState('');

    const isAuthorized = user && (user.role === 'staff' || user.role === 'finance' || user.email === 'simon@pezeka.com');

    const { data: allCustomers, loading: customersLoading } = useCollection<Customer>(isAuthorized ? 'customers' : null);

    const referralData = useMemo(() => {
        if (!allCustomers) return [];

        return allCustomers
            .filter(c => !!c.referredBy)
            .map(referred => {
                const referrer = allCustomers.find(c => c.referralCode === referred.referredBy);
                return {
                    id: referred.id,
                    referredName: referred.name,
                    referredPhone: referred.phone,
                    referralDate: referred.createdAt,
                    referrerName: referrer?.name || `Unknown (${referred.referredBy})`,
                    referrerPhone: referrer?.phone || 'N/A'
                };
            })
            .filter(item => 
                item.referredName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.referrerName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => (b.referralDate?.seconds || 0) - (a.referralDate?.seconds || 0));
    }, [allCustomers, searchTerm]);

    if (userLoading || customersLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthorized) {
        return <div className="p-12 text-center font-bold">Access Denied</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
                        <Share2 className="h-8 w-8" />
                        Referral Tracking
                    </h1>
                    <p className="text-muted-foreground mt-1">Monitor member growth via the customer referral program.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search referred or referrer..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-8 w-full sm:w-[300px]" 
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Total Referrals</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-primary">{referralData.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Top Referrer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold truncate">
                            {referralData.length > 0 ? referralData[0].referrerName : 'None yet'}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Recent Growth</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black flex items-center gap-2">
                            <Users className="h-6 w-6 text-green-500" />
                            Active
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-xl shadow-sm border-muted">
                <CardHeader>
                    <CardTitle>Referral Ledger</CardTitle>
                    <CardDescription>A record of who referred whom.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead>Referred Member</TableHead>
                                    <TableHead>Date Joined</TableHead>
                                    <TableHead>Referrer (Invited By)</TableHead>
                                    <TableHead className="text-right">Contact Info</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {referralData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">
                                            No referral records found matching your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    referralData.map((item) => {
                                        const rDate = item.referralDate?.seconds 
                                            ? new Date(item.referralDate.seconds * 1000) 
                                            : new Date();
                                        return (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <div className="font-black text-sm">{item.referredName}</div>
                                                    <div className="text-[10px] text-muted-foreground">{item.referredPhone}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <Calendar className="h-3 w-3 text-muted-foreground" />
                                                        {format(rDate, 'dd/MM/yyyy')}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="bg-[#5BA9D0]/10 text-[#5BA9D0] border-none font-bold">
                                                        {item.referrerName}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="text-[10px] font-medium text-muted-foreground">Referrer Phone:</div>
                                                    <div className="text-xs font-bold">{item.referrerPhone}</div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
