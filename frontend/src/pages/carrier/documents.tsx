import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FileText, Upload, Search, Filter, Download, Eye, Trash2, AlertCircle, CheckCircle, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface CarrierDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string | null;
  fileSize: number | null;
  expiryDate: string | null;
  isVerified: boolean;
  createdAt: string;
  truckId: string | null;
}

const documentTypeLabels: Record<string, string> = {
  license: "Driver's License",
  insurance: "Insurance",
  rc: "Registration",
  fitness: "Fitness Certificate",
  permit: "Permit",
  puc: "PUC Certificate",
  pod: "Proof of Delivery",
  invoice: "Invoice",
  other: "Other",
};

function isExpiringSoon(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const daysUntilExpiry = (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
}

function isExpired(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() < Date.now();
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CarrierDocumentsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use shared S3/object storage upload flow
  const { uploadFile, isUploading: isStorageUploading } = useUpload({
    onError: (err) => {
      console.error("Carrier documents upload error:", err);
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload file to storage. Please try again.",
        variant: "destructive",
      });
    },
  });

  const { data: documents = [], isLoading } = useQuery<CarrierDocument[]>({
    queryKey: ["/api/carrier/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { documentType: string; fileName: string; fileUrl: string; fileSize: number; expiryDate: string | null }) => {
      return apiRequest("POST", "/api/carrier/documents", data);
    },
    onSuccess: () => {
      toast({ title: "Document uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents"] });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedDocType("");
      setExpiryDate("");
    },
    onError: () => {
      toast({ title: "Failed to upload document", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest("DELETE", `/api/carrier/documents/${docId}`);
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/carrier/documents"] });
    },
    onError: () => {
      toast({ title: "Failed to delete document", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedDocType) {
      toast({ title: "Please select a file and document type", variant: "destructive" });
      return;
    }

    // 1) Upload the raw file bytes to object storage (S3/local) via presigned URL
    const uploadResponse = await uploadFile(selectedFile);
    if (!uploadResponse) {
      // Error is handled in useUpload's onError
      return;
    }

    const objectPath = uploadResponse.objectPath;
    const fileUrl =
      objectPath && !objectPath.startsWith("http")
        ? `${window.location.origin}${objectPath}`
        : objectPath;

    // 2) Save the carrier document pointing at the stored object path (/objects/uploads/...)
    uploadMutation.mutate({
      documentType: selectedDocType,
      fileName: selectedFile.name,
      fileUrl: fileUrl || "",
      fileSize: uploadResponse.metadata.size ?? selectedFile.size,
      expiryDate: expiryDate || null,
    });
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || doc.documentType === typeFilter;
    return matchesSearch && matchesType;
  });

  const complianceDocTypes = ["license", "insurance", "rc", "fitness", "permit", "puc"];
  const complianceDocuments = documents.filter(d => complianceDocTypes.includes(d.documentType));
  const verifiedCount = complianceDocuments.filter(d => d.isVerified).length;
  const expiringDocs = documents.filter((d) => isExpiringSoon(d.expiryDate));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-muted-foreground">Manage your compliance and trip documents.</p>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-document">
              <Upload className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload compliance documents to maintain your verified status.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div 
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover-elevate cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div>
                    <FileText className="h-10 w-10 mx-auto mb-2 text-primary" />
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG, or PNG up to 10MB</p>
                  </>
                )}
              </div>
              <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="license">Driver's License</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="rc">Registration Certificate</SelectItem>
                  <SelectItem value="fitness">Fitness Certificate</SelectItem>
                  <SelectItem value="permit">Permit</SelectItem>
                  <SelectItem value="puc">PUC Certificate</SelectItem>
                  <SelectItem value="pod">Proof of Delivery</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <label className="text-sm font-medium mb-1 block">Expiry Date (optional)</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  data-testid="input-expiry-date"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleUpload} 
                disabled={uploadMutation.isPending || isStorageUploading || !selectedFile || !selectedDocType}
                data-testid="button-confirm-upload"
              >
                {(uploadMutation.isPending || isStorageUploading) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
              <div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                  {verifiedCount}/{complianceDocuments.length || 4}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">Verified Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {expiringDocs.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 sm:col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    {expiringDocs.length} document{expiringDocs.length !== 1 ? "s" : ""} expiring soon
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Renew before they expire to maintain your verified status.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-documents"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-type-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="license">Driver's License</SelectItem>
            <SelectItem value="insurance">Insurance</SelectItem>
            <SelectItem value="rc">Registration</SelectItem>
            <SelectItem value="fitness">Fitness Certificate</SelectItem>
            <SelectItem value="permit">Permit</SelectItem>
            <SelectItem value="puc">PUC Certificate</SelectItem>
            <SelectItem value="pod">Proof of Delivery</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredDocuments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents found"
          description="Upload your compliance documents to get verified and start receiving loads."
          actionLabel="Upload Document"
          onAction={() => setUploadDialogOpen(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="hover-elevate" data-testid={`document-card-${doc.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</p>
                  </div>
                  {doc.isVerified ? (
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="secondary">
                      {documentTypeLabels[doc.documentType] || doc.documentType}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Uploaded</span>
                    <span>{format(new Date(doc.createdAt), "M/d/yyyy")}</span>
                  </div>
                  {doc.expiryDate && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Expires</span>
                      <Badge
                        variant={isExpired(doc.expiryDate) ? "destructive" : isExpiringSoon(doc.expiryDate) ? "default" : "secondary"}
                        className={isExpiringSoon(doc.expiryDate) && !isExpired(doc.expiryDate) 
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate" 
                          : "no-default-hover-elevate no-default-active-elevate"
                        }
                      >
                        {isExpired(doc.expiryDate) ? "Expired" : format(new Date(doc.expiryDate), "M/d/yyyy")}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1" 
                    onClick={() => doc.fileUrl && window.open(doc.fileUrl, "_blank")}
                    data-testid={`button-view-${doc.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => {
                      if (doc.fileUrl) {
                        const link = document.createElement("a");
                        link.href = doc.fileUrl;
                        link.download = doc.fileName;
                        link.click();
                      }
                    }}
                    data-testid={`button-download-${doc.id}`}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-${doc.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
