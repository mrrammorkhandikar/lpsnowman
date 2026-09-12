import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CloudOff,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, parseJsonResponse } from "@/lib/api-client";

type SalesRow = {
  loadId: string;
  loadNumber: string;
  shipperName: string;
  route: string;
  amount: number;
  hasMemo: boolean;
  bcCustomerNumber: string | null;
  bcOrderNumber: string | null;
  bcInvoiceNumber: string | null;
  lastError: string | null;
  lastPushedAt: string | null;
};

type SalesStatus = {
  configured: boolean;
  connected: boolean;
  environment?: string;
  companyId?: string | null;
  companyName?: string | null;
  error?: string;
  ourCount: number;
  orderCount: number;
  invoiceCount: number;
  errorCount: number;
  rows: SalesRow[];
  companies?: Array<{ id: string; name: string }>;
};

export default function AdminBc365SalesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery<SalesStatus>({
    queryKey: ["/api/admin/bc365-sales/status"],
    queryFn: async () => {
      const res = await apiGet("api/admin/bc365-sales/status", { timeoutMs: 60000 });
      return parseJsonResponse<SalesStatus>(res);
    },
    refetchInterval: 30000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/bc365-sales/status"] });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const res = await apiPost("api/admin/bc365-sales/push", {}, { timeoutMs: 300000 });
      return parseJsonResponse<{
        pushed: number;
        invoiceCount: number;
        errorCount: number;
        errors: Array<{ loadId: string; error: string }>;
      }>(res);
    },
    onSuccess: (result) => {
      toast({
        title: result.errorCount ? "Push finished with errors" : "Sales documents pushed",
        description: result.errorCount
          ? result.errors[0]?.error || `${result.errorCount} load(s) failed.`
          : "Customers, sales orders, and memos were written to BC 365.",
        variant: result.errorCount ? "destructive" : "default",
      });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Sales push failed", description: err.message, variant: "destructive" });
      invalidate();
    },
  });

  const pushOneMutation = useMutation({
    mutationFn: async (loadId: string) => {
      const res = await apiPost(`api/admin/bc365-sales/push/${loadId}`, {}, { timeoutMs: 60000 });
      return parseJsonResponse(res);
    },
    onSuccess: () => {
      toast({ title: "Load pushed", description: "This load was written as a BC 365 sales document." });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
      invalidate();
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BC 365 Sales documents</h1>
          <p className="text-sm text-muted-foreground">
            Pushes LoadPilot loads as native Business Central customers, sales orders, and sales invoices
            so the BC dashboard and reports can use them. The original LoadPilot Loads sync is unchanged.
          </p>
        </div>
        <Badge variant={data?.connected ? "default" : "destructive"}>
          {data?.connected ? "Connected" : "Not connected"}
        </Badge>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Environment</CardDescription>
            <CardTitle className="text-xl">{data?.environment || "—"}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data?.companyName || "No company selected"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Portal loads</CardDescription>
            <CardTitle className="text-3xl">{data?.ourCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sales orders on BC</CardDescription>
            <CardTitle className="text-3xl">{data?.orderCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sales invoices on BC</CardDescription>
            <CardTitle className="text-3xl">{data?.invoiceCount ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {data?.error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CloudOff className="h-4 w-4" />
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-destructive">{data.error}</CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => pushMutation.mutate()}
          disabled={pushMutation.isPending || !data?.connected}
          data-testid="button-bc365-sales-push"
        >
          <ArrowUpRight className="h-4 w-4 mr-2" />
          {pushMutation.isPending ? "Pushing…" : "Push loads as sales documents"}
        </Button>
        <Button variant="outline" onClick={() => invalidate()} disabled={isFetching} data-testid="button-bc365-sales-refresh">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Load mapping</CardTitle>
          <CardDescription>
            Each load becomes a sales order. A memo becomes a sales invoice. Description is the trip route and cargo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !data?.rows?.length ? (
            <p className="text-sm text-muted-foreground">No loads to push.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Load</TableHead>
                    <TableHead>Shipper</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>BC order</TableHead>
                    <TableHead>BC invoice</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.loadId}>
                      <TableCell className="font-medium">{row.loadNumber}</TableCell>
                      <TableCell>{row.shipperName || "—"}</TableCell>
                      <TableCell>{row.route}</TableCell>
                      <TableCell>
                        {row.amount > 0 ? `Rs. ${row.amount.toLocaleString("en-IN")}` : "—"}
                      </TableCell>
                      <TableCell>{row.bcOrderNumber || "—"}</TableCell>
                      <TableCell>{row.bcInvoiceNumber || (row.hasMemo ? "Pending" : "No memo")}</TableCell>
                      <TableCell className="max-w-[280px]">
                        {row.lastError ? (
                          <div className="space-y-1">
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                            <p className="text-xs text-destructive whitespace-normal break-words">{row.lastError}</p>
                          </div>
                        ) : row.bcOrderNumber ? (
                          <Badge>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Pushed
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not pushed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pushOneMutation.isPending}
                          onClick={() => pushOneMutation.mutate(row.loadId)}
                          data-testid={`button-push-load-${row.loadNumber}`}
                        >
                          Push
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
