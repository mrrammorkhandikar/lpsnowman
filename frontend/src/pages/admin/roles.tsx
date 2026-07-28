import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Plus, Pencil, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiDelete, apiGet, apiPatch, apiPost, parseJsonResponse } from "@/lib/api-client";
import type { AdminRole } from "@shared/schema";
import { OVERVIEW_PAGE_KEY } from "@/shared/admin-pages";

interface AdminPageDef {
  key: string;
  path: string;
  titleKey: string;
}

interface AdminRoleRow extends AdminRole {
  assignedAdminCount?: number;
}

interface RoleFormState {
  name: string;
  description: string;
  pageKeys: string[];
}

const emptyForm: RoleFormState = { name: "", description: "", pageKeys: [] };

export default function AdminRolesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<AdminRoleRow | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AdminRoleRow | null>(null);

  const { data: pages = [], isLoading: pagesLoading } = useQuery<AdminPageDef[]>({
    queryKey: ["/api/admin/pages"],
    queryFn: async () => {
      const res = await apiGet("api/admin/pages");
      if (!res.ok) throw new Error("Failed to load pages");
      const data = await parseJsonResponse<{ pages: AdminPageDef[] }>(res);
      return data.pages;
    },
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<AdminRoleRow[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: async () => {
      const res = await apiGet("api/admin/roles");
      if (!res.ok) throw new Error("Failed to load roles");
      return parseJsonResponse<AdminRoleRow[]>(res);
    },
  });

  const pageLabel = (key: string) => {
    const page = pages.find((p) => p.key === key);
    return page ? t(page.titleKey) : key;
  };

  const sortedPages = useMemo(
    () => [...pages].sort((a, b) => t(a.titleKey).localeCompare(t(b.titleKey))),
    [pages, t],
  );

  const openCreate = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (role: AdminRoleRow) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description || "",
      pageKeys: (role.pageKeys || []).filter((k) => k !== OVERVIEW_PAGE_KEY),
    });
    setIsDialogOpen(true);
  };

  const togglePageKey = (key: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      pageKeys: checked
        ? [...prev.pageKeys, key]
        : prev.pageKeys.filter((k) => k !== key),
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        pageKeys: form.pageKeys,
      };
      if (editingRole) {
        const res = await apiPatch(`api/admin/roles/${encodeURIComponent(editingRole.id)}`, body);
        if (!res.ok) {
          const err = await parseJsonResponse<{ error?: string }>(res);
          throw new Error(err.error || "Failed to update role");
        }
        return parseJsonResponse(res);
      }
      const res = await apiPost("api/admin/roles", body);
      if (!res.ok) {
        const err = await parseJsonResponse<{ error?: string }>(res);
        throw new Error(err.error || "Failed to create role");
      }
      return parseJsonResponse(res);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/roles/assignable"] });
      toast({
        title: editingRole ? "Role updated" : "Role created",
        description: `${form.name} has been saved.`,
      });
      setIsDialogOpen(false);
      setEditingRole(null);
      setForm(emptyForm);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not save role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (roleId: string) => {
      const res = await apiDelete(`api/admin/roles/${encodeURIComponent(roleId)}`);
      if (!res.ok) {
        const err = await parseJsonResponse<{ error?: string }>(res);
        throw new Error(err.error || "Failed to delete role");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/admin/roles/assignable"] });
      toast({ title: "Role deleted" });
      setDeleteTarget(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Could not delete role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isLoading = pagesLoading || rolesLoading;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-primary" />
            {t("nav.adminRoles")}
          </h1>
          <p className="text-muted-foreground mt-1">
            Create roles and choose which admin console pages each role can access. Overview is always included.
          </p>
        </div>
        <Button onClick={openCreate} data-testid="button-create-admin-role">
          <Plus className="h-4 w-4 mr-2" />
          New role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Admin roles</CardTitle>
          <CardDescription>
            Assign these roles when creating role-based admins from the Users page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading roles...</p>
          ) : roles.length === 0 ? (
            <p className="text-muted-foreground text-sm">No roles yet. Create one to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Admins</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="font-medium">{role.name}</div>
                      {role.description ? (
                        <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(role.pageKeys || [])
                          .filter((k) => k !== OVERVIEW_PAGE_KEY)
                          .map((key) => (
                            <Badge key={key} variant="secondary" className="text-xs">
                              {pageLabel(key)}
                            </Badge>
                          ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Users className="h-3.5 w-3.5" />
                        {role.assignedAdminCount ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(role)}
                        disabled={(role.assignedAdminCount ?? 0) > 0}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit role" : "Create role"}</DialogTitle>
            <DialogDescription>
              Select the admin pages this role can access. Overview is granted automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role name</Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Verification Admin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description (optional)</Label>
              <Textarea
                id="role-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Page access</Label>
              <ScrollArea className="h-56 rounded-md border p-3">
                <div className="space-y-3">
                  {sortedPages.map((page) => (
                    <label key={page.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={form.pageKeys.includes(page.key)}
                        onCheckedChange={(checked) => togglePageKey(page.key, checked === true)}
                      />
                      <span>{t(page.titleKey)}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || form.pageKeys.length === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Saving..." : "Save role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Delete &quot;{deleteTarget?.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
