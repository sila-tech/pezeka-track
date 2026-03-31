
'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore, useAppUser } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, FileText, Trash2, Calendar, User, ShieldCheck, Eye, Download, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { deleteKYCDocument } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';

interface KYCDocument {
    id: string;
    customerId: string;
    customerName: string;
    type: 'owner_id' | 'guarantor_id' | 'loan_form' | 'security_attachment' | 'guarantor_undertaking';
    fileName: string;
    fileUrl: string;
    uploadedBy: string;
    uploadedAt: any;
}

const TYPE_LABELS: Record<string, string> = {
    owner_id: 'Owner ID Card',
    guarantor_id: 'Guarantor ID Card',
    loan_form: 'Loan Form',
    security_attachment: 'Security Attachment',
    guarantor_undertaking: 'Guarantor Undertaking'
};

export default function KYCRepositoryPage() {
    const { user, loading: userLoading } = useAppUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<KYCDocument | null>(null);
    const [viewingDoc, setViewingDoc] = useState<KYCDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const isAuthorized = user && (user.role === 'finance' || user.email === 'simon@pezeka.com' || user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2');

    const { data: documents, loading: docsLoading } = useCollection<KYCDocument>(isAuthorized ? 'kyc_documents' : null);

    const filteredDocs = useMemo(() => {
        if (!documents) return [];
        return documents
            .filter(doc => 
                doc.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                TYPE_LABELS[doc.type]?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
    }, [documents, searchTerm]);

    const handleDeleteClick = (doc: KYCDocument) => {
        setDocToDelete(doc);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!docToDelete) return;
        setIsDeleting(true);
        try {
            await deleteKYCDocument(firestore, docToDelete.id);
            toast({ title: 'Document Record Removed' });
            setDeleteConfirmOpen(false);
            setDocToDelete(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
        } finally {
            setIsDeleting(false);
        }
    };

    if (userLoading || docsLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="p-12 text-center bg-card rounded-xl border border-dashed">
                <ShieldCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-bold">Finance Authorization Required</h2>
                <p className="text-muted-foreground mt-2">Only the Finance team can view and manage the KYC Document repository.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
                        <FileText className="h-8 w-8" />
                        KYC Repository
                    </h1>
                    <p className="text-muted-foreground mt-1">Review captured member identity and security documents.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search member or document type..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="pl-8 w-full sm:w-[350px]" 
                    />
                </div>
            </div>

            <Card className="rounded-xl shadow-sm border-muted overflow-hidden">
                <CardHeader>
                    <CardTitle>Captured Verification materials</CardTitle>
                    <CardDescription>Visual log of all captured KYC photos.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[65vh]">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[80px]">Preview</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Document Type</TableHead>
                                    <TableHead>Label / Note</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead>Date Recorded</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDocs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic">
                                            No KYC documents found matching your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredDocs.map((doc) => {
                                        const uDate = doc.uploadedAt?.seconds 
                                            ? new Date(doc.uploadedAt.seconds * 1000) 
                                            : new Date();
                                        return (
                                            <TableRow key={doc.id} className="group hover:bg-muted/30 transition-colors">
                                                <TableCell>
                                                    <div 
                                                        className="h-12 w-12 rounded border bg-muted flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => setViewingDoc(doc)}
                                                    >
                                                        {doc.fileUrl ? (
                                                            <img src={doc.fileUrl} alt="Thumbnail" className="h-full w-full object-cover" />
                                                        ) : (
                                                            <FileText className="h-6 w-6 text-muted-foreground" />
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-black text-sm">{doc.customerName}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-bold text-[10px] uppercase border-primary/20 text-primary bg-primary/5">
                                                        {TYPE_LABELS[doc.type]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs italic text-muted-foreground">
                                                    "{doc.fileName}"
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-xs">
                                                        <User className="h-3 w-3 text-muted-foreground" />
                                                        {doc.uploadedBy}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                        <Calendar className="h-3 w-3" />
                                                        {format(uDate, 'dd/MM/yyyy HH:mm')}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setViewingDoc(doc)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteClick(doc)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
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

            {/* View Image Dialog */}
            <Dialog open={!!viewingDoc} onOpenChange={(open) => !open && setViewingDoc(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-black">
                    <div className="relative w-full aspect-auto min-h-[400px] flex items-center justify-center bg-zinc-900">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-4 right-4 z-50 text-white bg-black/50 hover:bg-black/80 rounded-full"
                            onClick={() => setViewingDoc(null)}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                        
                        {viewingDoc?.fileUrl && (
                            <img src={viewingDoc.fileUrl} alt="Full Resolution KYC" className="max-w-full max-h-[85vh] object-contain" />
                        )}

                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white">
                            <h3 className="font-black text-xl">{viewingDoc?.customerName}</h3>
                            <p className="text-sm opacity-80">{TYPE_LABELS[viewingDoc?.type || '']} • {viewingDoc?.fileName}</p>
                            <div className="flex gap-4 mt-2 text-xs opacity-60">
                                <span>Uploaded by {viewingDoc?.uploadedBy}</span>
                                <span>{viewingDoc?.uploadedAt?.seconds ? format(new Date(viewingDoc.uploadedAt.seconds * 1000), 'PPP p') : ''}</span>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove KYC Record?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the visual record for <strong>{docToDelete?.fileName}</strong>. This action cannot be undone and the photo will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDocToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            Confirm Deletion
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
