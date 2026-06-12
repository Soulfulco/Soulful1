import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, UserCog, Building2, AlertCircle, Loader2 } from "lucide-react";
import { useListCompanies } from "@workspace/api-client-react";

type HrUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  company_id: number;
  company_name: string;
  created_at: string;
};

function useHrUsers() {
  return useQuery<HrUser[]>({
    queryKey: ["hr-users"],
    queryFn: async () => {
      const res = await fetch("/api/hr/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch HR users");
      return res.json();
    },
  });
}

export default function DashboardHrUsers() {
  const queryClient = useQueryClient();
  const { data: hrUsers = [], isLoading } = useHrUsers();
  const { data: companiesData } = useListCompanies();
  const companies = companiesData?.data ?? [];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", companyId: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (body: typeof form) => {
      const res = await fetch("/api/hr/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, companyId: Number(body.companyId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create HR user");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hr-users"] });
      setOpen(false);
      setForm({ name: "", email: "", password: "", companyId: "" });
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.companyId) {
      setFormError("Please select a company");
      return;
    }
    createMutation.mutate(form);
  }

  // Group users by company
  const grouped = hrUsers.reduce<Record<string, HrUser[]>>((acc, u) => {
    const key = u.company_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground">HR Portal Users</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage HR manager accounts for each corporate client
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add HR User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create HR Portal Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              {formError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label>Company</Label>
                <Select
                  value={form.companyId}
                  onValueChange={(v) => setForm((f) => ({ ...f, companyId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Work Email</Label>
                <Input
                  type="email"
                  placeholder="hr@company.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Set a secure password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Account
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : hrUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <UserCog className="h-10 w-10 text-muted-foreground mb-4" />
            <CardTitle className="text-lg mb-2">No HR users yet</CardTitle>
            <CardDescription>
              Create HR portal accounts to give corporate clients access to their wellbeing dashboard.
            </CardDescription>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([companyName, users]) => (
            <Card key={companyName}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{companyName}</CardTitle>
                  <Badge variant="secondary" className="ml-auto">
                    {users.length} {users.length === 1 ? "user" : "users"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.role === "hr_manager" ? "outline" : "default"} className="text-xs">
                          {u.role.replace("_", " ")}
                        </Badge>
                        <Badge variant={u.is_active ? "secondary" : "destructive"} className="text-xs">
                          {u.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="pt-5">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> HR users can only see data for their own company. They access the dashboard at{" "}
            <code className="bg-muted px-1 rounded text-xs">/dashboard/login</code> using their email and password.
            Updating or resetting passwords re-submits this form (upserts by email).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
