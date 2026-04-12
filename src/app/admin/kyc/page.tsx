'use client';

import { useMemo, useState, useRef } from 'react';
import { useCollection, useFirestore, useAppUser, useStorage } from '@/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, FileText, Trash2, Calendar, User, ShieldCheck, Eye, X, Lock, PlusCircle, Camera, Upload, ImagePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { deleteKYCDocument, uploadKYCDocument } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

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

const kycUploadSchema = z.object({
    customerId: z.string().min(1, "Please select a customer."),
    type: z.enum(['owner_id', 'guarantor_id', 'loan_form', 'security_attachment', 'guarantor_undertaking']),
    fileName: z.string().min(1, "Enter a label for this document."),
});

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
    const storage = useStorage();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<KYCDocument | null>(null);
    const [viewingDoc, setViewingDoc] = useState<KYCDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    
    // Upload States
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAuthorized = user && (
        user.role === 'finance' || 
        user.role === 'staff' || 
        user.email === 'simon@pezeka.com' || 
        user?.uid === 'gHZ9n7s2b9X8fJ2kP3s5t8YxVOE2'
    );

    const { data: documents, loading: docsLoading } = useCollection<KYCDocument>(isAuthorized ? 'kyc_documents' : null);
    const { data: customers } = useCollection<any>(isAuthorized ? 'customers' : null);

    const kycForm = useForm<z.infer<typeof kycUploadSchema>>({
        resolver: zodResolver(kycUploadSchema),
        defaultValues: { customerId: '', type: 'owner_id', fileName: '' },
    });

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

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setShowCamera(true);
            setCapturedImage(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Camera Error', description: 'Could not access camera.' });
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
        }
        setShowCamera(false);
    };

    const capturePhoto = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0);
                setCapturedImage(canvas.toDataURL('image/jpeg', 0.8));
                stopCamera();
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
                stopCamera();
            };
            reader.readAsDataURL(file);
        }
    };

    async function onKYCSubmit(values: z.infer<typeof kycUploadSchema>) {
        if (!user || !capturedImage) return;
        setIsSubmitting(true);
        try {
            const customer = customers?.find(c => c.id === values.customerId);
            await uploadKYCDocument(firestore, storage, {
                ...values,
                customerName: customer?.name || "Unknown",
                fileUrl: capturedImage,
                uploadedBy: user.name || user.email || "Staff"
            });
            toast({ title: "Document Saved" });
            kycForm.reset();
            setCapturedImage(null);
            setIsUploadOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Upload Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    }

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
            <div className="p-12 text-center bg-card rounded-xl border border-dashed flex flex-col items-center justify-center space-y-4">
                <div className="bg-destructive/10 p-4 rounded-full">
                    <Lock className="h-12 w-12 text-destructive" />
                </div>
                <h2 className="text-xl font-black">Admin Authorization Required</h2>
                <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
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
                    <p className="text-muted-foreground mt-1">Review and manage member identity materials.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search name or type..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="pl-8 w-full sm:w-[250px]" 
                        />
                    </div>
                    <Dialog open={isUploadOpen} onOpenChange={(o) => { setIsUploadOpen(o); if(!o) { stopCamera(); setCapturedImage(null); } }}>
                        <DialogTrigger asChild>
                            <Button className="font-bold"><PlusCircle className="mr-2 h-4 w-4" /> Add Document</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
                            <DialogHeader className="p-6 pb-0">
                                <DialogTitle>New KYC Capture</DialogTitle>
                                <DialogDescription>Link a photo or scan to a registered member.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh] px-6 py-4">
                                <Form {...kycForm}>
                                    <form id="kyc-upload-form" onSubmit={kycForm.handleSubmit(onKYCSubmit)} className="space-y-4">
                                        <FormField control={kycForm.control} name="customerId" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Member</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.accountNumber})</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}/>
                                        <FormField control={kycForm.control} name="type" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Category</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="owner_id">Owner ID Card</SelectItem>
                                                        <SelectItem value="guarantor_id">Guarantor ID Card</SelectItem>
                                                        <SelectItem value="loan_form">Physical Loan Form</SelectItem>
                                                        <SelectItem value="security_attachment">Security / Collateral</SelectItem>
                                                        <SelectItem value="guarantor_undertaking">Guarantor Undertaking</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}/>
                                        <FormField control={kycForm.control} name="fileName" render={({ field }) => (
                                            <FormItem><FormLabel>Document Label</FormLabel><FormControl><Input placeholder="e.g. ID Front" {...field} /></FormControl></FormItem>
                                        )}/>
                                        <div className="space-y-4 pt-2">
                                            <div className="relative min-h-[200px] bg-zinc-900 rounded-lg overflow-hidden border-2 border-muted flex items-center justify-center">
                                                {!showCamera && !capturedImage && (
                                                    <div className="text-center p-6 space-y-4">
                                                        <ImagePlus className="h-10 w-10 text-muted-foreground mx-auto" />
                                                        <div className="flex flex-col gap-2">
                                                            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> From Gallery</Button>
                                                            <Button type="button" variant="outline" size="sm" onClick={startCamera}><Camera className="mr-2 h-4 w-4" /> Use Camera</Button>
                                                        </div>
                                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                                    </div>
                                                )}
                                                <video ref={videoRef} className={`w-full h-full object-contain ${showCamera ? 'block' : 'hidden'}`} autoPlay muted playsInline />
                                                {capturedImage && <img src={capturedImage} alt="Capture" className="max-w-full max-h-[300px] object-contain" />}
                                            </div>
                                            {showCamera && <Button type="button" className="w-full" onClick={capturePhoto}>Capture Now</Button>}
                                            {capturedImage && (
                                                <div className="flex gap-2">
                                                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => fileInputRef.current?.click()}>Change File</Button>
                                                    <Button type="button" variant="outline" size="sm" className="flex-1" onClick={startCamera}>Retake Photo</Button>
                                                </div>
                                            )}
                                        </div>
                                    </form>
                                </Form>
                            </ScrollArea>
                            <DialogFooter className="p-6 pt-2">
                                <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                                <Button type="submit" form="kyc-upload-form" disabled={isSubmitting || !capturedImage}>
                                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                    Save Document
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Card className="rounded-xl shadow-sm border-muted overflow-hidden">
                <CardHeader>
                    <CardTitle>Verification Log</CardTitle>
                    <CardDescription>Click any row to view the document image.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[65vh]">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[52px]"></TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Document Type</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDocs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic">No matching records found.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredDocs.map((doc) => (
                                        <TableRow
                                            key={doc.id}
                                            className="group hover:bg-primary/5 transition-colors cursor-pointer"
                                            onClick={() => setViewingDoc(doc)}
                                        >
                                            <TableCell>
                                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <FileText className="h-5 w-5 text-primary" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-sm">{doc.customerName}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[11px] uppercase font-semibold tracking-wide">{TYPE_LABELS[doc.type]}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground italic">"{doc.fileName}"</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" /> {doc.uploadedBy}</div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{doc.uploadedAt?.seconds ? format(new Date(doc.uploadedAt.seconds * 1000), 'dd/MM/yy HH:mm') : ''}</TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" title="View Document" onClick={() => setViewingDoc(doc)}><Eye className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="text-destructive" title="Delete" onClick={() => handleDeleteClick(doc)}><Trash2 className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Dialog open={!!viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
                    <VisuallyHidden.Root>
                        <DialogTitle>KYC Document Preview</DialogTitle>
                    </VisuallyHidden.Root>
                    <div className="relative w-full h-[85vh] flex items-center justify-center">
                        <Button variant="ghost" size="icon" className="absolute top-4 right-4 z-50 text-white bg-black/50 rounded-full" onClick={() => setViewingDoc(null)}><X className="h-6 w-6" /></Button>
                        {viewingDoc?.fileUrl && <Image src={viewingDoc.fileUrl} alt="Full KYC" fill className="object-contain" sizes="100vw" unoptimized />}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white">
                            <h3 className="font-black text-xl">{viewingDoc?.customerName}</h3>
                            <p className="text-sm opacity-80">{TYPE_LABELS[viewingDoc?.type || '']} • {viewingDoc?.fileName}</p>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Delete KYC Document?</AlertDialogTitle><AlertDialogDescription>This action will permanently remove the image from storage.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDocToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive" disabled={isDeleting}>Confirm Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
