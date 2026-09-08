import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Trash2,
  Landmark,
  CheckCircle2,
  AlertTriangle,
  CloudOff,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, parseJsonResponse } from "@/lib/api-client";

type SyncMismatch = {
  loadId: string;
  loadNumber: string;
  fields: string[];
  source: "mismatch" | "missing_on_bc" | "extra_on_bc";
  paymentStatusOurs?: string;
  paymentStatusBc?: string;
};

type SyncStatus = {
  configured: boolean;
  connected: boolean;
  environment?: string;
  companyId: string | null;
  companyName: string | null;
  customerNumber: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastWipeAt: string | null;
  lastError: string | null;
  ourCount: number;
  syncedCount: number;
  mismatchedCount: number;
  missingOnBc: number;
  extraOnBc: number;
  percentSynced: number;
  isFullySynced: boolean;
  mismatches: SyncMismatch[];
  companies?: Array<{ id: string; name: string }>;
};

const CONFIRM_PHRASE = "ERASE BC LOADS";

function sourceLabel(source: SyncMismatch["source"]) {
  if (source === "missing_on_bc") return "On portal only";
  if (source === "extra_on_bc") return "On BC 365 only";
  return "Fields differ";
}

export default function AdminBc365SyncPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [wipeOpen, setWipeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const { data, isLoading, isFetching, error } = useQuery<SyncStatus>({
    queryKey: ["/api/admin/bc365/status"],
    queryFn: async () => {
      const res = await apiGet("api/admin/bc365/status", { timeoutMs: 60000 });
      return parseJsonResponse<SyncStatus>(res);
    },
    refetchInterval: 30000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/bc365/status"] });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiPost("api/admin/bc365/sync", {}, { timeoutMs: 180000 });
      return parseJsonResponse(res);
    },
    onSuccess: () => {
      toast({ title: "Sync started", description: "Portal loads were pushed to Business Central." });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const pullMutation = useMutation({
    mutationFn: async () => {
      const res = await apiPost("api/admin/bc365/pull-payments", {}, { timeoutMs: 120000 });
      return parseJsonResponse<{ updated: number; checked: number }>(res);
    },
    onSuccess: (result) => {
      toast({
        title: "Payment status pulled",
        description: `Updated ${result.updated} of ${result.checked} BC records.`,
      });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Payment pull failed", description: err.message, variant: "destructive" });
    },
  });

  const wipeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiPost(
        "api/admin/bc365/wipe",
        { confirm: CONFIRM_PHRASE },
        { timeoutMs: 180000 },
      );
      return parseJsonResponse(res);
    },
    onSuccess: () => {
      toast({ title: "BC load data erased", description: "LoadPilot sales orders were deleted on BC 365." });
      setWipeOpen(false);
      setConfirmText("");
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erase failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">BC 365 synchronization</h1>
          <p className="text-sm text-muted-foreground">
            This portal is the source for load details. Business Central receives every change.
            Only payment status is pulled back from BC 365.
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
            <CardDescription>Our loads vs BC 365</CardDescription>
            <CardTitle className="text-3xl">{data?.percentSynced ?? 0}%</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {data?.isFullySynced ? "100% of portal loads match BC 365" : "Not fully synced"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In sync</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              {data?.syncedCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            of {data?.ourCount ?? 0} portal loads
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Missing on BC 365</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <CloudOff className="h-6 w-6" />
              {data?.missingOnBc ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Portal records not on BC</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Extra / other on BC</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              {data?.extraOnBc ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Includes leftover data from other LoadPilot deployments
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Connection
          </CardTitle>
          <CardDescription>
            Environment {data?.environment || "unknown"} · company {data?.companyName || "not selected yet"}. Customer {data?.customerNumber || "LoadPilot (created on first sync)"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !data?.connected}
            data-testid="button-bc365-sync"
          >
            <ArrowUpRight className="mr-2 h-4 w-4" />
            {syncMutation.isPending ? "Syncing…" : "Sync all portal data to BC 365"}
          </Button>
          <Button
            variant="outline"
            onClick={() => pullMutation.mutate()}
            disabled={pullMutation.isPending || !data?.connected}
            data-testid="button-bc365-pull-payments"
          >
            <ArrowDownLeft className="mr-2 h-4 w-4" />
            {pullMutation.isPending ? "Pulling…" : "Pull payment status from BC"}
          </Button>
          <Button
            variant="outline"
            onClick={() => invalidate()}
            disabled={isFetching}
            data-testid="button-bc365-refresh"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh status
          </Button>
          <Button
            variant="destructive"
            onClick={() => setWipeOpen(true)}
            disabled={!data?.connected}
            data-testid="button-bc365-wipe"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Erase BC load data
          </Button>
        </CardContent>
      </Card>

      {data?.lastError && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Why it is not connected</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>{data.lastError}</p>
            <p className="text-muted-foreground">
              Env values look right (Production). The blocker is almost always the app not being
              enabled inside Business Central, not the .env path.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Mismatched and extra records</CardTitle>
          <CardDescription>
            {data?.mismatchedCount ?? 0} field mismatches. Use erase + full sync to replace leftover BC data with this portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading comparison…</p>
          ) : !data?.mismatches?.length ? (
            <p className="text-sm text-muted-foreground">No mismatches found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Load</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Payment here</TableHead>
                  <TableHead>Payment on BC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.mismatches.map((row) => (
                  <TableRow key={`${row.source}-${row.loadId}`}>
                    <TableCell className="font-medium">{row.loadNumber}</TableCell>
                    <TableCell>{sourceLabel(row.source)}</TableCell>
                    <TableCell>{row.fields.join(", ")}</TableCell>
                    <TableCell>{row.paymentStatusOurs || "—"}</TableCell>
                    <TableCell>{row.paymentStatusBc || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erase LoadPilot data on BC 365?</DialogTitle>
            <DialogDescription>
              This deletes LoadPilot-tagged sales orders on the sandbox company, including leftover
              records from other deployments. It does not delete this portal’s database. Type{" "}
              <span className="font-semibold">{CONFIRM_PHRASE}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="bc365-wipe-confirm">Confirmation</Label>
            <Input
              id="bc365-wipe-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              data-testid="input-bc365-wipe-confirm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWipeOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== CONFIRM_PHRASE || wipeMutation.isPending}
              onClick={() => wipeMutation.mutate()}
              data-testid="button-bc365-wipe-confirm"
            >
              {wipeMutation.isPending ? "Erasing…" : "Erase on BC 365"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
