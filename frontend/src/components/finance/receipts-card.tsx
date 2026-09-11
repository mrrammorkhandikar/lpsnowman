import { FileText, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDocumentUrl } from "@/lib/document-utils";
import { RECEIPT_CATEGORIES, getReceiptsForCategory } from "@/lib/receipt-document-types";

interface ReceiptDocument {
  id: string;
  documentType: string;
  fileUrl: string | null;
  isVerified?: boolean | null;
  fileName?: string | null;
}

interface FinanceReceiptsCardProps {
  documents: ReceiptDocument[];
  testIdPrefix?: string;
}

export function FinanceReceiptsCard({ documents, testIdPrefix = "finance-receipt" }: FinanceReceiptsCardProps) {
  const openReceipt = (fileUrl: string | null) => {
    const url = getDocumentUrl(fileUrl);
    if (url) window.open(url, "_blank");
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Receipts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {RECEIPT_CATEGORIES.map((receiptItem) => {
          const receipts = getReceiptsForCategory(documents, receiptItem.key);
          return (
            <div key={receiptItem.key} className="space-y-2" data-testid={`${testIdPrefix}-${receiptItem.key}`}>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{receiptItem.label}</span>
                </div>
                {receipts.length === 0 ? (
                  <Badge variant="outline" className="text-muted-foreground">
                    Not Uploaded
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {receipts.length} file{receipts.length === 1 ? "" : "s"}
                  </Badge>
                )}
              </div>
              {receipts.map((receipt, index) => {
                const hasDocument = !!receipt.fileUrl;
                const isVerified = receipt.isVerified === true;
                return (
                  <div
                    key={receipt.id}
                    className="flex items-center justify-between pl-6 pr-2 py-1"
                  >
                    <span className="text-xs text-muted-foreground truncate">
                      {receipt.fileName || `${receiptItem.label} ${index + 1}`}
                    </span>
                    <div>
                      {isVerified ? (
                        <Badge
                          className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-pointer"
                          onClick={() => openReceipt(receipt.fileUrl)}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          View
                        </Badge>
                      ) : hasDocument ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => openReceipt(receipt.fileUrl)}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
