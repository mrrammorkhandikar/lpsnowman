import { useEffect, useState } from "react";
import { differenceInDays, format } from "date-fns";
import { ExternalLink, FileText, Shield } from "lucide-react";
import { DocumentUploadWithCamera } from "@/components/DocumentUploadWithCamera";
import { DocumentPreviewPanel } from "@/components/document-preview-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { resolveDocumentDisplay } from "@/lib/document-utils";

function getDaysUntilExpiry(date: Date): number {
  return differenceInDays(new Date(date), new Date());
}

export interface TruckDocumentCardProps {
  title: string;
  icon: typeof Shield;
  documentUrl: string | null;
  /** When omitted or false, expiry is hidden. */
  showExpiry?: boolean;
  /** When false, expiry is shown read-only (carrier view). Defaults to true. */
  expiryEditable?: boolean;
  expiryDate?: Date | null;
  documentType: string;
  onUpload: (value: string) => void;
  onExpiryChange?: (date: string) => void;
  isUploading: boolean;
}

export function TruckDocumentCard({
  title,
  icon: Icon,
  documentUrl,
  showExpiry = true,
  expiryEditable = true,
  expiryDate = null,
  documentType,
  onUpload,
  onExpiryChange,
  isUploading,
}: TruckDocumentCardProps) {
  const [localExpiry, setLocalExpiry] = useState(
    expiryDate ? format(new Date(expiryDate), "yyyy-MM-dd") : "",
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    setLocalExpiry(expiryDate ? format(new Date(expiryDate), "yyyy-MM-dd") : "");
  }, [expiryDate]);

  const docDisplay = documentUrl ? resolveDocumentDisplay(documentUrl) : null;
  const daysLeft = expiryDate ? getDaysUntilExpiry(expiryDate) : null;
  const isExpired = daysLeft !== null && daysLeft < 0;
  const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft < 30;

  const getStatusColor = () => {
    if (!showExpiry || daysLeft === null) return "text-muted-foreground";
    if (isExpired) return "text-red-500";
    if (isExpiringSoon) return "text-amber-500";
    return "text-green-500";
  };

  const getBadgeClass = () => {
    if (!showExpiry || daysLeft === null) {
      return "bg-muted text-muted-foreground";
    }
    if (isExpired) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (isExpiringSoon) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  };

  const getBorderClass = () => {
    if (!showExpiry || daysLeft === null) return "";
    if (isExpired) return "border-red-500";
    if (isExpiringSoon) return "border-amber-500";
    return "";
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setLocalExpiry(newDate);
    if (newDate && onExpiryChange) {
      onExpiryChange(newDate);
    }
  };

  const badgeLabel =
    !showExpiry || daysLeft === null
      ? "No expiry set"
      : isExpired
        ? "Expired"
        : `${daysLeft} days left`;

  return (
    <>
      <Card className={getBorderClass()}>
        <CardContent className="pt-3 sm:pt-4 px-3 sm:px-4">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-2 sm:gap-3 flex-1 w-full">
              <Icon className={`h-4 w-4 sm:h-5 sm:w-5 mt-0.5 shrink-0 ${getStatusColor()}`} />
              <div className="flex-1 space-y-2 min-w-0">
                <div>
                  <p className="font-medium text-xs sm:text-sm">{title}</p>
                  {showExpiry && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {expiryEditable ? "Expires (admin):" : "Expires:"}
                      </span>
                      {expiryEditable ? (
                        <Input
                          type="date"
                          value={localExpiry}
                          onChange={handleExpiryChange}
                          className="h-7 w-full sm:w-[140px] text-xs"
                          data-testid={`input-expiry-${documentType}`}
                        />
                      ) : (
                        <span className="text-xs">
                          {expiryDate ? format(new Date(expiryDate), "dd MMM yyyy") : "Not set by admin"}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-1 sm:pt-2">
                  {docDisplay?.previewUrl ? (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <FileText className="h-3 w-3 mr-1" />
                        <span className="truncate max-w-[150px]">{docDisplay.displayName}</span>
                      </Badge>
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto p-0 text-xs text-primary flex items-center gap-1"
                        onClick={() => setPreviewOpen(true)}
                        data-testid={`link-view-${documentType}`}
                      >
                        <ExternalLink className="h-3 w-3" />
                        View
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No document uploaded</p>
                  )}
                </div>

                <div className="pt-1">
                  <DocumentUploadWithCamera
                    value={documentUrl || ""}
                    onChange={onUpload}
                    placeholder={`Upload ${title}`}
                    disabled={isUploading}
                    testId={`upload-${documentType}`}
                    documentType={documentType}
                  />
                </div>
              </div>
            </div>

            <Badge className={`text-xs whitespace-nowrap ${getBadgeClass()}`}>{badgeLabel}</Badge>
          </div>
        </CardContent>
      </Card>

      {docDisplay?.previewUrl && documentUrl && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{title}</DialogTitle>
            </DialogHeader>
            <DocumentPreviewPanel
              document={{
                fileUrl: documentUrl,
                fileName: docDisplay.displayName,
                documentType,
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
