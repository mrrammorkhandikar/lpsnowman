import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, generateIdempotencyKey } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  Send,
  Save,
  Loader2,
  IndianRupee,
  Percent,
  Calculator,
  Building2,
  MapPin,
  Package,
  Users,
  CheckCircle,
} from "lucide-react";

interface LineItem {
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface LoadData {
  id: string;
  loadId?: string;
  pickupCity: string;
  dropoffCity: string;
  weight: number | string;
  weightUnit?: string;
  requiredTruckType: string;
  distance?: number | string;
  shipperId?: string;
  cargoDescription?: string;
  adminFinalPrice?: string | number;
  adminReferenceNumber?: number | null;
  shipperLoadNumber?: number | null;
}

interface PricingBreakdown {
  baseAmount: number;
  fuelSurcharge: number;
  handlingFee: number;
  tollCharges?: number;
  insuranceFee?: number;
  adminFee?: number;
}

interface InvoiceBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadData | null;
  pricing?: PricingBreakdown;
  adminId?: string;
  onSuccess?: () => void;
}

const paymentTermsOptions = [
  { value: "Net 0", label: "Due Immediately" },
  { value: "Net 7", label: "Net 7 Days" },
  { value: "Net 15", label: "Net 15 Days" },
  { value: "Net 30", label: "Net 30 Days" },
];

// GST removed from workflow - invoice shows final load price only

export function InvoiceBuilder({
  open,
  onOpenChange,
  load,
  pricing,
  adminId,
  onSuccess,
}: InvoiceBuilderProps) {
  const { toast } = useToast();
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [notes, setNotes] = useState("");
  const [marginPercent, setMarginPercent] = useState(15);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (open && load && pricing) {
      const initialItems: LineItem[] = [];
      
      if (pricing.baseAmount > 0) {
        initialItems.push({
          code: "BASE",
          description: `Base Freight Cost (${load.pickupCity} to ${load.dropoffCity})`,
          quantity: 1,
          unitPrice: pricing.baseAmount,
          amount: pricing.baseAmount,
        });
      }
      
      if (pricing.fuelSurcharge > 0) {
        initialItems.push({
          code: "FUEL",
          description: "Fuel Surcharge",
          quantity: 1,
          unitPrice: pricing.fuelSurcharge,
          amount: pricing.fuelSurcharge,
        });
      }
      
      if (pricing.handlingFee > 0) {
        initialItems.push({
          code: "HAND",
          description: "Loading/Unloading & Handling Fee",
          quantity: 1,
          unitPrice: pricing.handlingFee,
          amount: pricing.handlingFee,
        });
      }
      
      if (pricing.tollCharges && pricing.tollCharges > 0) {
        initialItems.push({
          code: "TOLL",
          description: "Toll Charges",
          quantity: 1,
          unitPrice: pricing.tollCharges,
          amount: pricing.tollCharges,
        });
      }
      
      if (pricing.insuranceFee && pricing.insuranceFee > 0) {
        initialItems.push({
          code: "INS",
          description: "Cargo Insurance",
          quantity: 1,
          unitPrice: pricing.insuranceFee,
          amount: pricing.insuranceFee,
        });
      }
      
      if (pricing.adminFee && pricing.adminFee > 0) {
        initialItems.push({
          code: "ADMIN",
          description: "Platform Service Fee",
          quantity: 1,
          unitPrice: pricing.adminFee,
          amount: pricing.adminFee,
        });
      }
      
      if (initialItems.length === 0 && load.adminFinalPrice) {
        const price = typeof load.adminFinalPrice === 'string' 
          ? parseFloat(load.adminFinalPrice) 
          : load.adminFinalPrice;
        initialItems.push({
          code: "FREIGHT",
          description: `Freight Cost (${load.pickupCity} to ${load.dropoffCity})`,
          quantity: 1,
          unitPrice: price,
          amount: price,
        });
      }
      
      setLineItems(initialItems);
    }
  }, [open, load, pricing]);

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.amount, 0);
  }, [lineItems]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * discountValue) / 100;
    }
    return discountValue;
  }, [subtotal, discountType, discountValue]);

  const afterDiscount = useMemo(() => {
    return subtotal - discountAmount;
  }, [subtotal, discountAmount]);

  // GST removed - total is just the after-discount amount
  const totalAmount = useMemo(() => {
    return afterDiscount;
  }, [afterDiscount]);

  const platformMargin = useMemo(() => {
    return (afterDiscount * marginPercent) / 100;
  }, [afterDiscount, marginPercent]);

  const estimatedCarrierPayout = useMemo(() => {
    return afterDiscount - platformMargin;
  }, [afterDiscount, platformMargin]);

  const formatRupees = (amount: number) => {
    return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { code: "", description: "", quantity: 1, unitPrice: 0, amount: 0 },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    if (field === "quantity" || field === "unitPrice") {
      const numValue = typeof value === 'string' ? parseFloat(value) || 0 : value;
      updated[index][field] = numValue;
      updated[index].amount = updated[index].quantity * updated[index].unitPrice;
    } else {
      (updated[index][field] as any) = value;
    }
    setLineItems(updated);
  };

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const dueDate = new Date();
      const days = parseInt(paymentTerms.replace("Net ", "")) || 30;
      dueDate.setDate(dueDate.getDate() + days);

      const invoiceData = {
        loadId: load?.id,
        shipperId: load?.shipperId,
        lineItems,
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        discountReason,
        taxPercent: "0",
        taxAmount: "0",
        totalAmount: totalAmount.toString(),
        paymentTerms,
        dueDate: dueDate.toISOString(),
        notes,
        platformMargin: platformMargin.toString(),
        estimatedCarrierPayout: estimatedCarrierPayout.toString(),
        status: "draft",
      };

      if (invoiceId) {
        return apiRequest("PATCH", `/api/admin/invoices/${invoiceId}`, invoiceData);
      } else {
        return apiRequest("POST", "/api/admin/invoices/generate", invoiceData);
      }
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setInvoiceId(data.id || data.invoice?.id);
      toast({
        title: "Draft Saved",
        description: "Invoice draft has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    },
  });

  const validateInvoice = (): string | null => {
    if (lineItems.length === 0) {
      return "Please add at least one line item to the invoice.";
    }
    if (totalAmount <= 0) {
      return "Invoice total must be greater than zero.";
    }
    if (!load?.shipperId) {
      return "Shipper information is missing.";
    }
    return null;
  };

  const handleDownloadPDF = () => {
    const invoiceNumber = invoiceId ? `MM-${invoiceId.slice(-8).toUpperCase()}` : `MM-DRAFT-${Date.now()}`;
    const content = `
INVOICE
========================================
Invoice Number: ${invoiceNumber}
Date: ${new Date().toLocaleDateString('en-IN')}
Due Date: ${paymentTerms}

FROM: Load Smart Platform
TO: Shipper ID ${load?.shipperId || 'N/A'}

LOAD DETAILS:
Route: ${load?.pickupCity} to ${load?.dropoffCity}
Weight: ${load?.weight} ${load?.weightUnit || 'tons'}
Truck Type: ${load?.requiredTruckType}

LINE ITEMS:
${lineItems.map(item => `${item.code} - ${item.description}: Rs. ${item.amount.toLocaleString('en-IN')}`).join('\n')}

----------------------------------------
Subtotal: Rs. ${subtotal.toLocaleString('en-IN')}
${discountAmount > 0 ? `Discount: Rs. ${discountAmount.toLocaleString('en-IN')}\n` : ''}----------------------------------------
TOTAL: Rs. ${totalAmount.toLocaleString('en-IN')}
========================================

${notes ? `Notes: ${notes}` : ''}

Thank you for your business!
    `;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Invoice Downloaded",
      description: "Invoice has been downloaded. (PDF generation coming soon)",
    });
  };

  const sendToShipperMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateInvoice();
      if (validationError) {
        throw new Error(validationError);
      }

      const dueDate = new Date();
      const days = parseInt(paymentTerms.replace("Net ", "")) || 30;
      dueDate.setDate(dueDate.getDate() + days);

      const invoiceData = {
        loadId: load?.id,
        shipperId: load?.shipperId,
        lineItems,
        subtotal: subtotal.toString(),
        discountAmount: discountAmount.toString(),
        discountReason,
        taxPercent: "0",
        taxAmount: "0",
        totalAmount: totalAmount.toString(),
        paymentTerms,
        dueDate: dueDate.toISOString(),
        notes,
        platformMargin: platformMargin.toString(),
        estimatedCarrierPayout: estimatedCarrierPayout.toString(),
        status: "sent",
        sendToShipper: true,
        idempotencyKey,
      };

      if (invoiceId) {
        await apiRequest("PATCH", `/api/admin/invoices/${invoiceId}`, invoiceData);
        return apiRequest("POST", `/api/admin/invoices/${invoiceId}/send`, { notifyShipper: true });
      } else {
        return apiRequest("POST", "/api/admin/invoices/generate", invoiceData);
      }
    },
    onSuccess: async () => {
      toast({
        title: "Invoice Sent",
        description: "Invoice has been sent to the shipper successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/shipper"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/loads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      const message = error.message.includes(':') 
        ? error.message.split(':').slice(1).join(':').trim() 
        : error.message;
      toast({
        title: "Invoice Failed",
        description: message || "Failed to send invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!load) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Builder
          </DialogTitle>
          <DialogDescription>
            Create and customize invoice for Load #{load.adminReferenceNumber || load.shipperLoadNumber || '—'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Load Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{load.pickupCity} → {load.dropoffCity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{load.weight} {load.weightUnit || 'tons'} | {load.requiredTruckType}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Line Items</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  data-testid="button-add-line-item"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted/50 grid grid-cols-12 gap-2 p-2 text-xs font-medium">
                  <div className="col-span-2">Code</div>
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2 text-right">Qty</div>
                  <div className="col-span-2 text-right">Unit Price</div>
                  <div className="col-span-1 text-right">Amount</div>
                  <div className="col-span-1"></div>
                </div>
                {lineItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 p-2 border-t items-center">
                    <div className="col-span-2">
                      <Input
                        value={item.code}
                        onChange={(e) => updateLineItem(index, "code", e.target.value)}
                        placeholder="CODE"
                        className="h-8 text-sm"
                        data-testid={`input-line-code-${index}`}
                      />
                    </div>
                    <div className="col-span-4">
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder="Description"
                        className="h-8 text-sm"
                        data-testid={`input-line-desc-${index}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                        className="h-8 text-sm text-right"
                        data-testid={`input-line-qty-${index}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                        className="h-8 text-sm text-right"
                        data-testid={`input-line-price-${index}`}
                      />
                    </div>
                    <div className="col-span-1 text-right text-sm font-medium">
                      {formatRupees(item.amount)}
                    </div>
                    <div className="col-span-1 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        className="h-8 w-8 text-destructive"
                        data-testid={`button-remove-line-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {lineItems.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No line items. Click "Add Item" to add charges.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Discount</Label>
                  <div className="flex gap-2">
                    <Select value={discountType} onValueChange={(v) => setDiscountType(v as "fixed" | "percent")}>
                      <SelectTrigger className="w-28" data-testid="select-discount-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed (Rs.)</SelectItem>
                        <SelectItem value="percent">Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      className="flex-1"
                      data-testid="input-discount-value"
                    />
                  </div>
                  <Input
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="Discount reason (optional)"
                    className="text-sm"
                    data-testid="input-discount-reason"
                  />
                </div>


                <div className="space-y-2">
                  <Label>Payment Terms</Label>
                  <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                    <SelectTrigger data-testid="select-payment-terms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTermsOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Platform Margin (%)</Label>
                  <Input
                    type="number"
                    value={marginPercent}
                    onChange={(e) => setMarginPercent(parseFloat(e.target.value) || 0)}
                    min="0"
                    max="50"
                    data-testid="input-margin"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Card className="bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Invoice Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatRupees(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-destructive">
                        <span>Discount</span>
                        <span>- {formatRupees(discountAmount)}</span>
                      </div>
                    )}
                    {discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">After Discount</span>
                        <span>{formatRupees(afterDiscount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatRupees(totalAmount)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 space-y-2 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        Platform Margin
                      </span>
                      <span className="text-primary font-medium">{formatRupees(platformMargin)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        Est. Carrier Payout
                      </span>
                      <span className="font-medium">{formatRupees(estimatedCarrierPayout)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes / Terms</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes, terms, or instructions..."
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => saveDraftMutation.mutate()}
            disabled={saveDraftMutation.isPending || sendToShipperMutation.isPending}
            data-testid="button-save-draft"
          >
            {saveDraftMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Draft
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPDF}
            disabled={lineItems.length === 0}
            data-testid="button-download-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button
            onClick={() => sendToShipperMutation.mutate()}
            disabled={saveDraftMutation.isPending || sendToShipperMutation.isPending || lineItems.length === 0}
            data-testid="button-send-shipper"
          >
            {sendToShipperMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send to Shipper
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
