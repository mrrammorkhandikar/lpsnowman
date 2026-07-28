import { useState } from "react";
import { 
  FileText, Upload, Download, Eye, Trash2, CheckCircle, Clock, 
  AlertCircle, X, File, Image, Camera 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  useMockData, 
  ShipmentDocument, 
  DocumentTemplateId, 
  ShipmentStage,
  documentTemplates,
  TrackedShipment 
} from "@/lib/mock-data-store";
import { useToast } from "@/hooks/use-toast";

interface DocumentManagerProps {
  shipment: TrackedShipment;
  compact?: boolean;
}

const stageLabels: Record<ShipmentStage, string> = {
  load_created: "Load Created",
  carrier_assigned: "Carrier Assigned",
  reached_pickup: "Reached Pickup",
  loaded: "Loaded",
  in_transit: "In Transit",
  arrived_at_drop: "Arrived at Drop",
  delivered: "Delivered",
  completed: "Completed",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isPhotoTemplate(templateId: DocumentTemplateId): boolean {
  return templateId === "loading_photos" || 
         templateId === "delivery_photos" || 
         templateId === "inspection_photos";
}

function getDocumentIcon(templateId: DocumentTemplateId) {
  if (isPhotoTemplate(templateId)) {
    return Image;
  }
  return FileText;
}

function getStatusBadge(status: ShipmentDocument["status"]) {
  switch (status) {
    case "verified":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    case "uploaded":
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate">
          <Upload className="h-3 w-3 mr-1" />
          Uploaded
        </Badge>
      );
    case "not_uploaded":
      return (
        <Badge className="bg-muted text-muted-foreground no-default-hover-elevate no-default-active-elevate">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return null;
  }
}

export function DocumentManager({ shipment, compact = false }: DocumentManagerProps) {
  const { uploadDocument, verifyDocument, deleteDocument } = useMockData();
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<ShipmentDocument | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<DocumentTemplateId | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!selectedTemplateId || !selectedFile) {
      toast({
        title: "Missing Information",
        description: "Please select a document type and file.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    
    try {
      const fileType = selectedFile.type.startsWith("image/") ? "image" : "pdf";
      uploadDocument(
        shipment.shipmentId,
        selectedTemplateId as DocumentTemplateId,
        selectedFile.name,
        fileType,
        shipment.currentStage
      );

      const template = documentTemplates.find(t => t.id === selectedTemplateId);
      toast({
        title: "Document Uploaded",
        description: `${template?.name || selectedFile.name} has been uploaded successfully.`,
      });

      setUploadDialogOpen(false);
      setSelectedTemplateId("");
      setSelectedFile(null);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "There was an error uploading the document. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = (doc: ShipmentDocument) => {
    setSelectedDocument(doc);
    setPreviewDialogOpen(true);
  };

  const handleVerify = (docId: string) => {
    verifyDocument(docId);
    toast({
      title: "Document Verified",
      description: "The document has been marked as verified.",
    });
  };

  const handleDelete = (docId: string) => {
    deleteDocument(docId);
    toast({
      title: "Document Deleted",
      description: "The document has been removed.",
    });
    setPreviewDialogOpen(false);
    setSelectedDocument(null);
  };

  const getAvailableTemplates = () => {
    const uploaded = shipment.documents.map(d => d.templateId);
    return documentTemplates.filter(t => !uploaded.includes(t.id) || isPhotoTemplate(t.id));
  };

  const groupedDocuments = shipment.documents.reduce((acc, doc) => {
    const stage = doc.stage;
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(doc);
    return acc;
  }, {} as Record<ShipmentStage, ShipmentDocument[]>);

  const requiredDocs = documentTemplates.filter(t => t.required);
  const uploadedRequiredDocs = shipment.documents.filter(d => 
    requiredDocs.some(r => r.id === d.templateId)
  );
  const missingRequired = requiredDocs.filter(r => 
    !shipment.documents.some(d => d.templateId === r.id)
  );

  if (compact) {
    return (
      <div className="space-y-2">
        {shipment.documents.slice(0, 3).map((doc) => {
          const Icon = getDocumentIcon(doc.templateId);
          const template = documentTemplates.find(t => t.id === doc.templateId);
          return (
            <Button 
              key={doc.docId}
              variant="outline" 
              className="w-full justify-start" 
              onClick={() => handlePreview(doc)}
              data-testid={`button-doc-${doc.docId}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {template?.name || doc.fileName}
              <span className="ml-auto">{getStatusBadge(doc.status)}</span>
            </Button>
          );
        })}
        
        {missingRequired.length > 0 && (
          <Button 
            variant="outline" 
            className="w-full justify-start" 
            disabled
            data-testid="button-pending-pod"
          >
            <FileText className="h-4 w-4 mr-2" />
            {missingRequired[0].name}
            <Badge variant="secondary" className="ml-auto text-muted-foreground">Pending</Badge>
          </Button>
        )}

        <Button 
          variant="outline" 
          className="w-full justify-start" 
          onClick={() => setUploadDialogOpen(true)}
          data-testid="button-upload-doc"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>

        <UploadDialog 
          open={uploadDialogOpen}
          onOpenChange={setUploadDialogOpen}
          availableTemplates={getAvailableTemplates()}
          selectedTemplateId={selectedTemplateId}
          setSelectedTemplateId={setSelectedTemplateId}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          uploading={uploading}
          onUpload={handleUpload}
        />

        <PreviewDialog
          open={previewDialogOpen}
          onOpenChange={setPreviewDialogOpen}
          document={selectedDocument}
          onVerify={handleVerify}
          onDelete={handleDelete}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-base">Shipment Documents</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {uploadedRequiredDocs.length}/{requiredDocs.length} Required
          </Badge>
          <Button 
            size="sm" 
            onClick={() => setUploadDialogOpen(true)}
            data-testid="button-upload-document"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {shipment.documents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No documents uploaded yet</p>
            <p className="text-xs mt-1">Upload BOL, POD, invoices, and other shipping documents</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-4">
              {Object.entries(groupedDocuments).map(([stage, docs]) => (
                <div key={stage}>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {stageLabels[stage as ShipmentStage]}
                  </p>
                  <div className="space-y-2">
                    {docs.map((doc) => {
                      const Icon = getDocumentIcon(doc.templateId);
                      const template = documentTemplates.find(t => t.id === doc.templateId);
                      return (
                        <div 
                          key={doc.docId}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate cursor-pointer"
                          onClick={() => handlePreview(doc)}
                          data-testid={`doc-row-${doc.docId}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{template?.name || doc.fileName}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(doc.fileSize)} - {doc.uploadedAt?.toLocaleDateString() || "N/A"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(doc.status)}
                            <Button 
                              size="icon" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreview(doc);
                              }}
                              data-testid={`button-preview-${doc.docId}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {missingRequired.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Missing Required Documents
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {missingRequired.map((doc) => (
                <Badge 
                  key={doc.id} 
                  variant="secondary" 
                  className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200"
                >
                  {doc.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      <UploadDialog 
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        availableTemplates={getAvailableTemplates()}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        uploading={uploading}
        onUpload={handleUpload}
      />

      <PreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        document={selectedDocument}
        onVerify={handleVerify}
        onDelete={handleDelete}
      />
    </Card>
  );
}

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableTemplates: typeof documentTemplates[number][];
  selectedTemplateId: DocumentTemplateId | "";
  setSelectedTemplateId: (id: DocumentTemplateId | "") => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  uploading: boolean;
  onUpload: () => void;
}

function UploadDialog({
  open,
  onOpenChange,
  availableTemplates,
  selectedTemplateId,
  setSelectedTemplateId,
  selectedFile,
  setSelectedFile,
  uploading,
  onUpload,
}: UploadDialogProps) {

  const createMockFile = (name: string, type: string): File => {
    const blob = new Blob(["mock file content"], { type });
    const file = Object.assign(blob, {
      name,
      lastModified: Date.now(),
      webkitRelativePath: "",
    }) as File;
    return file;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Select a document type and upload a file. Supported formats: PDF, JPG, PNG
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Document Type</Label>
            <Select 
              value={selectedTemplateId} 
              onValueChange={(v) => setSelectedTemplateId(v as DocumentTemplateId)}
            >
              <SelectTrigger data-testid="select-doc-type">
                <SelectValue placeholder="Select document type..." />
              </SelectTrigger>
              <SelectContent>
                {availableTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <span>{template.name}</span>
                      {template.required && (
                        <Badge variant="secondary" className="text-xs">Required</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>File</Label>
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4" />
                    <span className="text-sm">{selectedFile.name}</span>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    onClick={() => setSelectedFile(null)}
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Click to browse or drag and drop
                    </p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    data-testid="input-file-upload"
                  />
                </label>
              )}
            </div>
          </div>

          {selectedTemplateId && isPhotoTemplate(selectedTemplateId as DocumentTemplateId) && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                const mockFile = createMockFile("camera-capture.jpg", "image/jpeg");
                setSelectedFile(mockFile);
              }}
              data-testid="button-capture-photo"
            >
              <Camera className="h-4 w-4 mr-2" />
              Capture Photo
            </Button>
          )}
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-upload"
          >
            Cancel
          </Button>
          <Button 
            onClick={onUpload} 
            disabled={!selectedTemplateId || !selectedFile || uploading}
            data-testid="button-confirm-upload"
          >
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: ShipmentDocument | null;
  onVerify: (docId: string) => void;
  onDelete: (docId: string) => void;
}

function PreviewDialog({
  open,
  onOpenChange,
  document,
  onVerify,
  onDelete,
}: PreviewDialogProps) {
  if (!document) return null;

  const template = documentTemplates.find(t => t.id === document.templateId);
  const Icon = getDocumentIcon(document.templateId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>{template?.name || document.fileName}</DialogTitle>
              <DialogDescription>
                Uploaded by {document.uploadedBy || "Unknown"} on {document.uploadedAt?.toLocaleDateString() || "N/A"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <div className="aspect-[4/3] rounded-lg bg-muted flex items-center justify-center mb-4">
            {document.fileType === "image" ? (
              <div className="text-center text-muted-foreground">
                <Image className="h-16 w-16 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Image Preview</p>
                <p className="text-xs">{document.fileName}</p>
              </div>
            ) : (
              <div className="text-center text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-2 opacity-50" />
                <p className="text-sm">PDF Preview</p>
                <p className="text-xs">{document.fileName}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">File Size</p>
              <p className="font-medium">{formatFileSize(document.fileSize)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <div className="mt-1">{getStatusBadge(document.status)}</div>
            </div>
            <div>
              <p className="text-muted-foreground">Stage</p>
              <p className="font-medium">{stageLabels[document.stage]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Document Type</p>
              <p className="font-medium">{template?.name || "Unknown"}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="destructive" 
            onClick={() => onDelete(document.docId)}
            data-testid="button-delete-document"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <div className="flex-1" />
          <Button 
            variant="outline"
            data-testid="button-download-document"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          {document.status !== "verified" && (
            <Button 
              onClick={() => onVerify(document.docId)}
              data-testid="button-verify-document"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Mark Verified
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentStatusSummary({ shipment }: { shipment: TrackedShipment }) {
  const requiredDocs = documentTemplates.filter(t => t.required);
  const uploadedRequired = shipment.documents.filter(d => 
    requiredDocs.some(r => r.id === d.templateId)
  );
  const verifiedDocs = shipment.documents.filter(d => d.status === "verified");

  return (
    <div className="flex items-center gap-4 text-sm flex-wrap">
      <div className="flex items-center gap-1">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span>{shipment.documents.length} docs</span>
      </div>
      <div className="flex items-center gap-1">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <span>{verifiedDocs.length} verified</span>
      </div>
      <Badge 
        className={`no-default-hover-elevate no-default-active-elevate ${
          uploadedRequired.length === requiredDocs.length 
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        }`}
      >
        {uploadedRequired.length}/{requiredDocs.length} required
      </Badge>
    </div>
  );
}
