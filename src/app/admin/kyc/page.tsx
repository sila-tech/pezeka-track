'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import { useCollection, useFirestore, useAppUser, useStorage } from '@/firebase';
import { canAccessStaffModules } from '@/lib/admin-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Loader2, PlusCircle, Eye, Trash2, User, Calendar, 
  ShieldCheck, Sparkles, AlertTriangle, AlertCircle, CheckCircle, 
  ChevronDown, Check, Camera, Upload, ImagePlus, Lock, FileText, X, CheckCircle2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface KYCDocument {
    id: string;
    customerId: string;
    customerName: string;
    type: 'owner_id' | 'guarantor_id' | 'loan_form' | 'security_attachment' | 'guarantor_undertaking' | 'mpesa_statement' | 'id_front' | 'id_back' | 'payslip';
    fileName: string;
    fileUrl: string;
    uploadedBy: string;
    uploadedAt: any;
    documentPassword?: string;
}

const kycUploadSchema = z.object({
    customerId: z.string().min(1, "Please select a customer."),
    type: z.enum(['owner_id', 'guarantor_id', 'loan_form', 'security_attachment', 'guarantor_undertaking', 'mpesa_statement', 'id_front', 'id_back', 'payslip']),
    fileName: z.string().min(1, "Enter a label for this document."),
});

const TYPE_LABELS: Record<string, string> = {
    owner_id: 'Owner ID Card',
    guarantor_id: 'Guarantor ID Card',
    loan_form: 'Loan Form',
    security_attachment: 'Security Attachment',
    guarantor_undertaking: 'Guarantor Undertaking',
    mpesa_statement: 'M-Pesa Statement',
    id_front: 'ID Front',
    id_back: 'ID Back',
    payslip: 'Payslip'
};

export default function KYCRepositoryPage() {
    const { user, loading: userLoading } = useAppUser();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<KYCDocument | null>(null);
    const [viewingDoc, setViewingDoc] = useState<KYCDocument | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCustomerSelectOpen, setIsCustomerSelectOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    
    // Upload States
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
    const isAuthorized = canAccessStaffModules(user);

    const { data: documents, loading: docsLoading } = useCollection<KYCDocument>(isAuthorized ? 'kyc_documents' : null);
    const { data: customers, loading: customersLoading } = useCollection<any>(isAuthorized ? 'customers' : null);
    const { data: allLoans } = useCollection<any>(isAuthorized ? 'loans' : null);

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

    const groupedCustomers = useMemo(() => {
        const groups: Record<string, { customerId: string, customerName: string, docs: KYCDocument[], latestUpload: number }> = {};
        
        filteredDocs.forEach(doc => {
            if (!groups[doc.customerId]) {
                groups[doc.customerId] = {
                    customerId: doc.customerId,
                    customerName: doc.customerName,
                    docs: [],
                    latestUpload: 0
                };
            }
            groups[doc.customerId].docs.push(doc);
            const docTime = doc.uploadedAt?.seconds || 0;
            if (docTime > groups[doc.customerId].latestUpload) {
                groups[doc.customerId].latestUpload = docTime;
            }
        });
        
        return Object.values(groups).sort((a, b) => b.latestUpload - a.latestUpload);
    }, [filteredDocs]);

    const selectedCustomer = useMemo(() => {
        if (!selectedCustomerId || !groupedCustomers) return null;
        return groupedCustomers.find(g => g.customerId === selectedCustomerId) || null;
    }, [groupedCustomers, selectedCustomerId]);

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
        
        const idToDelete = docToDelete.id;
        
        // 1. Close dialog immediately to prevent UI blocking/focus issues
        setDeleteConfirmOpen(false);
        setIsDeleting(true);
        
        try {
            // 2. Perform background deletion
            await deleteKYCDocument(firestore, idToDelete);
            toast({ title: 'Document Record Removed' });
        } catch (e: any) {
            toast({ 
                variant: 'destructive', 
                title: 'Action Failed', 
                description: e.message || 'Check your permissions and try again.' 
            });
        } finally {
            // 3. Cleanup
            setIsDeleting(false);
            setDocToDelete(null);
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
                                                <Popover open={isCustomerSelectOpen} onOpenChange={setIsCustomerSelectOpen}>
                                                  <PopoverTrigger asChild>
                                                    <FormControl>
                                                      <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                          "w-full justify-between h-14 text-left font-normal border-primary/20 hover:border-primary transition-all shadow-sm",
                                                          !field.value && "text-muted-foreground"
                                                        )}
                                                      >
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                                <User className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Selected Member</span>
                                                                <span className="font-semibold text-foreground">
                                                                    {field.value
                                                                        ? customers?.find((c) => c.id === field.value)?.name || "Unknown Member"
                                                                        : "Find member by name, phone or ID..."}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50 text-primary" />
                                                      </Button>
                                                    </FormControl>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-[400px] p-0 shadow-2xl border-primary/10" align="start">
                                                    <div className="flex flex-col h-[400px]">
                                                        <div className="p-3 border-b bg-muted/30 sticky top-0 z-10">
                                                            <div className="relative">
                                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                                                                <Input 
                                                                    placeholder="Type name, phone or account number..." 
                                                                    className="pl-9 h-11 bg-background border-primary/20 focus-visible:ring-primary"
                                                                    value={customerSearch}
                                                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                        </div>
                                                        <ScrollArea className="flex-1">
                                                            <div className="p-2 space-y-1">
                                                                {customersLoading ? (
                                                                    <div className="flex items-center justify-center py-10">
                                                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        {(() => {
                                                                            const filtered = customers?.filter(c => 
                                                                                (c.name?.toLowerCase().includes(customerSearch.toLowerCase()) || 
                                                                                 c.phone?.includes(customerSearch) || 
                                                                                 c.idNumber?.includes(customerSearch) ||
                                                                                 c.accountNumber?.toLowerCase().includes(customerSearch.toLowerCase()))
                                                                            ).slice(0, 50);

                                                                            if (!filtered || filtered.length === 0) {
                                                                                return (
                                                                                    <div className="text-center py-10 px-4">
                                                                                        <User className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                                                                        <p className="text-sm text-muted-foreground font-medium">No members found</p>
                                                                                        <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
                                                                                    </div>
                                                                                );
                                                                            }

                                                                            return filtered.map((c) => (
                                                                                <button
                                                                                    key={c.id}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        kycForm.setValue("customerId", c.id);
                                                                                        setIsCustomerSelectOpen(false);
                                                                                    }}
                                                                                    className={cn(
                                                                                        "w-full text-left px-3 py-3 flex items-center gap-3 rounded-lg transition-all hover:bg-primary/5 group",
                                                                                        field.value === c.id ? "bg-primary/10 border border-primary/20 shadow-sm" : "border border-transparent hover:border-primary/10"
                                                                                    )}
                                                                                >
                                                                                    <div className={cn(
                                                                                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm",
                                                                                        field.value === c.id ? "bg-primary text-primary-foreground scale-110" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                                                                                    )}>
                                                                                        {field.value === c.id ? <CheckCircle2 className="h-6 w-6" /> : <User className="h-5 w-5" />}
                                                                                    </div>
                                                                                    <div className="flex flex-col min-w-0 flex-1">
                                                                                        <span className={cn(
                                                                                            "font-black text-sm truncate",
                                                                                            field.value === c.id ? "text-primary" : "text-slate-900"
                                                                                        )}>{c.name || "Unnamed Member"}</span>
                                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                                            <Badge variant="outline" className="text-[10px] py-0 h-4 bg-background font-black border-primary/20 px-1.5 text-primary">
                                                                                                {c.accountNumber || 'NO-ACC'}
                                                                                            </Badge>
                                                                                            <span className="text-[10px] text-slate-500 font-bold truncate">
                                                                                                ID: {c.idNumber || 'PENDING'} • {c.phone}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </button>
                                                                            ));
                                                                        })()}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </ScrollArea>
                                                    </div>
                                                  </PopoverContent>
                                                </Popover>
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
                                                        <SelectItem value="mpesa_statement">M-Pesa Statement</SelectItem>
                                                        <SelectItem value="id_front">ID Front</SelectItem>
                                                        <SelectItem value="id_back">ID Back</SelectItem>
                                                        <SelectItem value="payslip">Payslip</SelectItem>
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
                                    <TableHead>Total Documents</TableHead>
                                    <TableHead>Latest Upload</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupedCustomers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground italic">No matching records found.</TableCell>
                                    </TableRow>
                                ) : (
                                    groupedCustomers.map((group) => (
                                        <TableRow
                                            key={group.customerId}
                                            className="group hover:bg-primary/5 transition-colors cursor-pointer"
                                            onClick={() => setSelectedCustomerId(group.customerId)}

                                        >
                                            <TableCell>
                                                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                                    <User className="h-5 w-5 text-primary" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-sm">{group.customerName}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="font-semibold">{group.docs.length} Document(s)</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{group.latestUpload ? format(new Date(group.latestUpload * 1000), 'dd/MM/yy HH:mm') : 'N/A'}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(group.customerId); }}>View Documents</Button>

                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>

            <Sheet open={!!selectedCustomerId} onOpenChange={(open) => !open && setSelectedCustomerId(null)}>

                <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="text-2xl">{selectedCustomer?.customerName}</SheetTitle>
                        <p className="text-sm text-muted-foreground">Uploaded KYC Documents</p>
                    </SheetHeader>
                    <div className="space-y-4">
                        {selectedCustomer?.docs.map(doc => (
                            <div key={doc.id} className="flex flex-col p-4 border rounded-lg bg-card space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                            <FileText className="h-5 w-5 text-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <Badge variant="outline" className="w-fit text-[10px] uppercase font-semibold mb-1">{TYPE_LABELS[doc.type]}</Badge>
                                            <span className="text-sm font-medium">"{doc.fileName}"</span>
                                            <span className="text-xs text-muted-foreground">{doc.uploadedAt?.seconds ? format(new Date(doc.uploadedAt.seconds * 1000), 'dd/MM/yy HH:mm') : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button variant="ghost" size="icon" title="View Document" onClick={() => setViewingDoc(doc)}><Eye className="h-4 w-4" /></Button>
                                        <Button variant="ghost" size="icon" className="text-destructive" title="Delete" onClick={() => handleDeleteClick(doc)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                {doc.documentPassword && (
                                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md border text-sm">
                                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="text-muted-foreground">Document Password:</span>
                                        <span className="font-mono font-medium">{doc.documentPassword}</span>
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {/* AI Statement Analysis Report */}
                        {(() => {
                            if (!selectedCustomer || !allLoans) return null;
                            const customerLoans = allLoans.filter((l: any) => l.customerId === selectedCustomer.customerId);
                            const loanWithAnalysis = customerLoans.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).find((l: any) => l.aiAnalysis);
                            if (!loanWithAnalysis) return null;
                            const analysis = loanWithAnalysis.aiAnalysis;
                            
                            const getRiskColor = (level: string) => {
                                if (level.includes('Zero') || level.includes('Qualified')) return 'text-green-600 bg-green-50 border-green-200';
                                if (level.includes('Moderate')) return 'text-amber-600 bg-amber-50 border-amber-200';
                                return 'text-red-600 bg-red-50 border-red-200';
                            };

                            const getRiskIcon = (level: string) => {
                                if (level.includes('Zero') || level.includes('Qualified')) return <CheckCircle className="h-5 w-5 text-green-600" />;
                                if (level.includes('Moderate')) return <AlertCircle className="h-5 w-5 text-amber-600" />;
                                return <AlertTriangle className="h-5 w-5 text-red-600" />;
                            };

                            return (
                                <div className="mt-8 border-2 border-indigo-100 bg-indigo-50/30 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-indigo-100/50 px-4 py-3 border-b border-indigo-100 flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-indigo-600" />
                                        <h4 className="font-black text-indigo-900">AI Statement Analysis</h4>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-1">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk Assessment</p>
                                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${getRiskColor(analysis.riskLevel)}`}>
                                                    {getRiskIcon(analysis.riskLevel)}
                                                    <span className="font-bold text-sm">{analysis.riskLevel}</span>
                                                </div>
                                            </div>
                                            <div className="text-right space-y-1">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Flow Summary</p>
                                                <p className="text-sm font-bold text-green-700">IN: KES {analysis.incomeFlow?.toLocaleString() || 0}</p>
                                                <p className="text-sm font-bold text-red-700">OUT: KES {analysis.expenditure?.toLocaleString() || 0}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white rounded-lg p-3 border shadow-sm">
                                            <p className="text-sm text-slate-700 leading-relaxed">{analysis.decisionReason}</p>
                                        </div>

                                        {(analysis.redFlags?.length > 0 || analysis.otherDebts?.length > 0) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {analysis.redFlags?.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Red Flags</p>
                                                        <ul className="space-y-1">
                                                            {analysis.redFlags.map((flag: string, i: number) => (
                                                                <li key={i} className="text-xs text-slate-700 bg-red-50 px-2 py-1 rounded border border-red-100 flex items-start gap-1">
                                                                    <span className="text-red-500">•</span> {flag}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {analysis.otherDebts?.length > 0 && (
                                                    <div className="space-y-2">
                                                        <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Other Debts / Loans</p>
                                                        <ul className="space-y-1">
                                                            {analysis.otherDebts.map((debt: string, i: number) => (
                                                                <li key={i} className="text-xs text-slate-700 bg-amber-50 px-2 py-1 rounded border border-amber-100 flex items-start gap-1">
                                                                    <span className="text-amber-500">•</span> {debt}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </SheetContent>
            </Sheet>
            <Dialog open={!!viewingDoc} onOpenChange={(o) => !o && setViewingDoc(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none">
                    <VisuallyHidden.Root>
                        <DialogTitle>KYC Document Preview</DialogTitle>
                    </VisuallyHidden.Root>
                    <div className="relative w-full h-[85vh] flex items-center justify-center bg-black">
                        <div className="absolute top-4 right-4 z-50 flex gap-2">
                            {viewingDoc?.fileUrl && (viewingDoc.fileUrl.toLowerCase().includes('.pdf') || viewingDoc.fileUrl.toLowerCase().includes('alt=media') === false || viewingDoc.type === 'mpesa_statement' || viewingDoc.type === 'payslip' || viewingDoc.type === 'loan_form') && (
                                <Button variant="secondary" onClick={() => window.open(viewingDoc.fileUrl, '_blank')}>Open in New Tab</Button>
                            )}
                            <Button variant="ghost" size="icon" className="text-white bg-black/50 hover:bg-black/80 rounded-full" onClick={() => setViewingDoc(null)}><X className="h-6 w-6" /></Button>
                        </div>
                        {viewingDoc?.fileUrl && (viewingDoc.fileUrl.toLowerCase().includes('.pdf') || viewingDoc.fileUrl.toLowerCase().includes('alt=media') === false || viewingDoc.type === 'mpesa_statement' || viewingDoc.type === 'payslip' || viewingDoc.type === 'loan_form' ? (
                            <iframe src={viewingDoc.fileUrl} className="w-full h-full border-none bg-white" title="PDF Document" />
                        ) : (
                            <Image src={viewingDoc.fileUrl} alt="Full KYC" fill className="object-contain" sizes="100vw" unoptimized />
                        ))}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent text-white pointer-events-none">
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
