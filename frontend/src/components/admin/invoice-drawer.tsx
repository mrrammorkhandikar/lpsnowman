import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileText,
  Plus,
  Trash2,
  Send,
  Save,
  IndianRupee,
  Percent,
  Loader2,
  Building2,
  MapPin,
  Package,
  Calendar,
  Receipt,
  Printer,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface LoadData {
  id: string;
  pickupCity: string;
  dropoffCity: string;
  weight: number | string;
  requiredTruckType: string;
  distance?: number | string;
  pickupDate?: string | Date;
  shipperId: string;
  cargoDescription?: string;
  rateType?: string;
  shipperPricePerTon?: string | number | null;
  shipperFixedPrice?: string | number | null;
  advancePaymentPercent?: number | null;
  adminFinalPrice?: string | number | null;
  carrierAdvancePercent?: number | null;
  finalPrice?: string | number | null;
  acceptedBidAmount?: string | number | null;
}

interface ShipperData {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  load: LoadData | null;
  shipper?: ShipperData | null;
  pricingAmount?: number;
  onSuccess?: () => void;
}

const formatCurrency = (amount: number): string => {
  return `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export function InvoiceDrawer({
  open,
  onOpenChange,
  load,
  shipper,
  pricingAmount,
  onSuccess,
}: InvoiceDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("details");
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const getInitialLineItems = (): LineItem[] => {
    if (load && pricingAmount && pricingAmount > 0) {
      return [{
        id: crypto.randomUUID(),
        description: `Freight Transportation: ${load.pickupCity} to ${load.dropoffCity}`,
        quantity: 1,
        rate: pricingAmount,
        amount: pricingAmount,
      }];
    }
    return [];
  };

  const [lineItems, setLineItems] = useState<LineItem[]>(getInitialLineItems);
  const [fuelSurcharge, setFuelSurcharge] = useState(0);
  const [tollCharges, setTollCharges] = useState(0);
  const [handlingFee, setHandlingFee] = useState(0);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [taxPercent, setTaxPercent] = useState(18);
  const [paymentTerms, setPaymentTerms] = useState("Net 30");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const calculateDueDate = (terms: string): string => {
    const daysToAdd = terms === "Due on Receipt" ? 0 : 
                      terms === "Net 7" ? 7 :
                      terms === "Net 15" ? 15 : 
                      terms === "Net 30" ? 30 : 
                      terms === "Net 45" ? 45 : 30;
    const due = new Date();
    due.setDate(due.getDate() + daysToAdd);
    return due.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (open && load && pricingAmount) {
      const baseLineItem: LineItem = {
        id: crypto.randomUUID(),
        description: `Freight Transportation: ${load.pickupCity} to ${load.dropoffCity}`,
        quantity: 1,
        rate: pricingAmount,
        amount: pricingAmount,
      };
      setLineItems([baseLineItem]);
      
      const distanceKm = typeof load.distance === 'number' ? load.distance : parseFloat(String(load.distance) || '500');
      setFuelSurcharge(Math.round(distanceKm * 2.5));
      setTollCharges(Math.round(distanceKm * 1.2));
      setHandlingFee(500);
      setInsuranceFee(Math.round(pricingAmount * 0.005));
      setDueDate(calculateDueDate(paymentTerms));
    }
  }, [open, load, pricingAmount]);

  useEffect(() => {
    setDueDate(calculateDueDate(paymentTerms));
  }, [paymentTerms]);

  const subtotal = useMemo(() => {
    const itemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    return itemsTotal + fuelSurcharge + tollCharges + handlingFee + insuranceFee;
  }, [lineItems, fuelSurcharge, tollCharges, handlingFee, insuranceFee]);

  const discountedSubtotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const taxAmount = useMemo(() => {
    return Math.round(discountedSubtotal * (taxPercent / 100) * 100) / 100;
  }, [discountedSubtotal, taxPercent]);

  const totalAmount = useMemo(() => {
    return discountedSubtotal + taxAmount;
  }, [discountedSubtotal, taxAmount]);

  const addLineItem = () => {
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      description: "",
      quantity: 1,
      rate: 0,
      amount: 0,
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'rate') {
          updated.amount = updated.quantity * updated.rate;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const handleSaveDraft = async () => {
    if (!load) return;
    
    setIsSaving(true);
    
    // Check if this is a mock load (starts with "LD-") vs a real database load (UUID)
    const isMockLoad = load.id.startsWith("LD-");
    
    if (isMockLoad) {
      // Handle mock loads locally without API calls
      setTimeout(() => {
        toast({
          title: "Invoice Saved",
          description: "Invoice has been saved as draft.",
        });
        onSuccess?.();
        onOpenChange(false);
        setIsSaving(false);
      }, 500);
      return;
    }
    
    try {
      await apiRequest("POST", "/api/admin/invoices", {
        loadId: load.id,
        shipperId: load.shipperId,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate.toString(),
          amount: item.amount.toString(),
        })),
        subtotal: subtotal.toString(),
        fuelSurcharge: fuelSurcharge.toString(),
        tollCharges: tollCharges.toString(),
        handlingFee: handlingFee.toString(),
        insuranceFee: insuranceFee.toString(),
        discountAmount: discountAmount.toString(),
        discountReason,
        taxPercent: taxPercent.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paymentTerms,
        dueDate,
        notes,
      });

      toast({
        title: "Invoice Saved",
        description: "Invoice has been saved as draft.",
      });

      queryClient.invalidateQueries({ queryKey: ['/api/admin/invoices'] });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendInvoice = async () => {
    if (!load) return;
    
    setIsSending(true);
    
    // Check if this is a mock load (starts with "LD-") vs a real database load (UUID)
    const isMockLoad = load.id.startsWith("LD-");
    
    if (isMockLoad) {
      // Handle mock loads locally without API calls
      setTimeout(() => {
        toast({
          title: "Invoice Sent",
          description: "Invoice has been created and sent to the shipper.",
        });
        onSuccess?.();
        onOpenChange(false);
        setIsSending(false);
      }, 500);
      return;
    }
    
    try {
      const response = await apiRequest("POST", "/api/admin/invoices", {
        loadId: load.id,
        shipperId: load.shipperId,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          rate: item.rate.toString(),
          amount: item.amount.toString(),
        })),
        subtotal: subtotal.toString(),
        fuelSurcharge: fuelSurcharge.toString(),
        tollCharges: tollCharges.toString(),
        handlingFee: handlingFee.toString(),
        insuranceFee: insuranceFee.toString(),
        discountAmount: discountAmount.toString(),
        discountReason,
        taxPercent: taxPercent.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paymentTerms,
        dueDate,
        notes,
      });

      const invoice = await response.json() as { id: string };
      
      await apiRequest("POST", `/api/admin/invoices/${invoice.id}/send`);

      toast({
        title: "Invoice Sent",
        description: "Invoice has been created and sent to the shipper.",
      });

      queryClient.invalidateQueries({ queryKey: ['/api/admin/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/queue'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/dashboard'] });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!load) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col" data-testid="drawer-invoice">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Invoice Builder
          </SheetTitle>
          <SheetDescription>
            Create and send invoice for {load.pickupCity} to {load.dropoffCity}
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mt-4">
            <TabsTrigger value="details" data-testid="tab-invoice-details">
              <FileText className="h-4 w-4 mr-2" />
              Details
            </TabsTrigger>
            <TabsTrigger value="charges" data-testid="tab-invoice-charges">
              <IndianRupee className="h-4 w-4 mr-2" />
              Charges
            </TabsTrigger>
            <TabsTrigger value="preview" data-testid="tab-invoice-preview">
              <Printer className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 py-4">
            <TabsContent value="details" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Load Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">From:</span>
                      <span className="font-medium">{load.pickupCity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">To:</span>
                      <span className="font-medium">{load.dropoffCity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Weight:</span>
                      <span className="font-medium">{load.weight} tons</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Truck:</span>
                      <Badge variant="outline">{load.requiredTruckType}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Summary - Pricing Lifecycle */}
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" />
                    Cost Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {/* Shipper's Pricing */}
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Rate Type</span>
                    <span className="font-medium">
                      {load.rateType === "fixed_price" ? "Fixed Price" : "Per Tonne Rate"}
                    </span>
                  </div>
                  {load.rateType === "per_ton" && load.shipperPricePerTon && (
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Shipper's Rate</span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(parseFloat(String(load.shipperPricePerTon)))} / tonne
                      </span>
                    </div>
                  )}
                  {load.rateType === "fixed_price" && load.shipperFixedPrice && (
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Shipper's Fixed Price</span>
                      <span className="font-medium text-blue-600">
                        {formatCurrency(parseFloat(String(load.shipperFixedPrice)))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-muted-foreground">Preferred Advance</span>
                    <span className="font-medium text-orange-600">{load.advancePaymentPercent || 0}%</span>
                  </div>
                  {load.adminFinalPrice && (
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Admin Posted Price</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(parseFloat(String(load.adminFinalPrice)))}
                      </span>
                    </div>
                  )}
                  {load.acceptedBidAmount && (
                    <div className="flex justify-between py-1 border-b">
                      <span className="text-muted-foreground">Final Negotiated Price</span>
                      <span className="font-medium text-green-600">
                        {formatCurrency(parseFloat(String(load.acceptedBidAmount)))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 bg-muted/50 rounded px-2 mt-2">
                    <span className="font-semibold">Invoice Total</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(parseFloat(String(load.adminFinalPrice || load.shipperFixedPrice || pricingAmount || 0)))}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Bill To (Shipper)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {shipper ? (
                    <>
                      <p className="font-medium">{shipper.companyName || shipper.name}</p>
                      {shipper.address && <p className="text-muted-foreground">{shipper.address}</p>}
                      {shipper.gstNumber && (
                        <p className="text-muted-foreground">GSTIN: {shipper.gstNumber}</p>
                      )}
                      {shipper.email && <p className="text-muted-foreground">{shipper.email}</p>}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Shipper ID: {load.shipperId}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">Line Items</CardTitle>
                  <Button size="sm" variant="outline" onClick={addLineItem} data-testid="button-add-line-item">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        {index === 0 && <Label className="text-xs">Description</Label>}
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          placeholder="Item description"
                          data-testid={`input-line-item-desc-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <Label className="text-xs">Qty</Label>}
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          min={1}
                          data-testid={`input-line-item-qty-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <Label className="text-xs">Rate</Label>}
                        <Input
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateLineItem(item.id, 'rate', parseFloat(e.target.value) || 0)}
                          min={0}
                          data-testid={`input-line-item-rate-${index}`}
                        />
                      </div>
                      <div className="col-span-2">
                        {index === 0 && <Label className="text-xs">Amount</Label>}
                        <Input
                          value={formatCurrency(item.amount)}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeLineItem(item.id)}
                          disabled={lineItems.length === 1}
                          data-testid={`button-remove-line-item-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Payment Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Payment Terms</Label>
                      <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                        <SelectTrigger data-testid="select-payment-terms">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                          <SelectItem value="Net 7">Net 7</SelectItem>
                          <SelectItem value="Net 15">Net 15</SelectItem>
                          <SelectItem value="Net 30">Net 30</SelectItem>
                          <SelectItem value="Net 45">Net 45</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Due Date</Label>
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        data-testid="input-due-date"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Notes / Terms & Conditions</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any notes or payment instructions..."
                      rows={3}
                      data-testid="textarea-invoice-notes"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="charges" className="mt-0 space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Additional Charges</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Fuel Surcharge</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={fuelSurcharge}
                          onChange={(e) => setFuelSurcharge(parseFloat(e.target.value) || 0)}
                          className="pl-9"
                          data-testid="input-fuel-surcharge"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Toll Charges</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={tollCharges}
                          onChange={(e) => setTollCharges(parseFloat(e.target.value) || 0)}
                          className="pl-9"
                          data-testid="input-toll-charges"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Handling Fee</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={handlingFee}
                          onChange={(e) => setHandlingFee(parseFloat(e.target.value) || 0)}
                          className="pl-9"
                          data-testid="input-handling-fee"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Insurance Fee</Label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          value={insuranceFee}
                          onChange={(e) => setInsuranceFee(parseFloat(e.target.value) || 0)}
                          className="pl-9"
                          data-testid="input-insurance-fee"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Discount</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Discount Amount</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                        className="pl-9"
                        data-testid="input-discount-amount"
                      />
                    </div>
                  </div>
                  {discountAmount > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Discount Reason</Label>
                      <Input
                        value={discountReason}
                        onChange={(e) => setDiscountReason(e.target.value)}
                        placeholder="e.g., Repeat customer, Early payment, etc."
                        data-testid="input-discount-reason"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Tax (GST)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">GST Rate (%)</Label>
                    <Select value={taxPercent.toString()} onValueChange={(v) => setTaxPercent(parseInt(v))}>
                      <SelectTrigger data-testid="select-tax-percent">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% (Exempt)</SelectItem>
                        <SelectItem value="5">5% GST</SelectItem>
                        <SelectItem value="12">12% GST</SelectItem>
                        <SelectItem value="18">18% GST</SelectItem>
                        <SelectItem value="28">28% GST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    GST Amount: {formatCurrency(taxAmount)}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <Card className="bg-card">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-2xl font-bold text-primary">INVOICE</h2>
                      <p className="text-muted-foreground text-sm">Load Smart Logistics</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-medium">Invoice Date</p>
                      <p className="text-muted-foreground">{new Date().toLocaleDateString('en-IN')}</p>
                      <p className="font-medium mt-2">Due Date</p>
                      <p className="text-muted-foreground">{dueDate ? new Date(dueDate).toLocaleDateString('en-IN') : '-'}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Bill To:</p>
                      {shipper ? (
                        <>
                          <p className="font-medium">{shipper.companyName || shipper.name}</p>
                          {shipper.address && <p>{shipper.address}</p>}
                          {shipper.gstNumber && <p>GSTIN: {shipper.gstNumber}</p>}
                        </>
                      ) : (
                        <p>Shipper ID: {load.shipperId}</p>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Load Details:</p>
                      <p>{load.pickupCity} → {load.dropoffCity}</p>
                      <p>{load.weight} tons, {load.requiredTruckType}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                      <div className="col-span-6">Description</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Rate</div>
                      <div className="col-span-2 text-right">Amount</div>
                    </div>
                    <Separator />
                    {lineItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-6">{item.description || '-'}</div>
                        <div className="col-span-2 text-right">{item.quantity}</div>
                        <div className="col-span-2 text-right">{formatCurrency(item.rate)}</div>
                        <div className="col-span-2 text-right">{formatCurrency(item.amount)}</div>
                      </div>
                    ))}
                    {fuelSurcharge > 0 && (
                      <div className="grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-10">Fuel Surcharge</div>
                        <div className="col-span-2 text-right">{formatCurrency(fuelSurcharge)}</div>
                      </div>
                    )}
                    {tollCharges > 0 && (
                      <div className="grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-10">Toll Charges</div>
                        <div className="col-span-2 text-right">{formatCurrency(tollCharges)}</div>
                      </div>
                    )}
                    {handlingFee > 0 && (
                      <div className="grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-10">Handling Fee</div>
                        <div className="col-span-2 text-right">{formatCurrency(handlingFee)}</div>
                      </div>
                    )}
                    {insuranceFee > 0 && (
                      <div className="grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-10">Insurance Fee</div>
                        <div className="col-span-2 text-right">{formatCurrency(insuranceFee)}</div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount {discountReason && `(${discountReason})`}</span>
                        <span>- {formatCurrency(discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST ({taxPercent}%)</span>
                      <span>{formatCurrency(taxAmount)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Amount</span>
                      <span className="text-primary">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>

                  {notes && (
                    <>
                      <Separator />
                      <div className="text-sm">
                        <p className="font-medium text-muted-foreground mb-1">Notes:</p>
                        <p className="whitespace-pre-wrap">{notes}</p>
                      </div>
                    </>
                  )}

                  <div className="text-center pt-4 border-t">
                    <p className="text-xs text-muted-foreground">Payment Terms: {paymentTerms}</p>
                    <p className="text-xs text-muted-foreground mt-1">Thank you for your business!</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <SheetFooter className="pt-4 border-t flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              Total: {formatCurrency(totalAmount)}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSaving || isSending}
              data-testid="button-save-invoice-draft"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              onClick={handleSendInvoice}
              disabled={isSaving || isSending || lineItems.length === 0}
              data-testid="button-send-invoice"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Invoice
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
