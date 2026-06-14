import { useState } from "react";
import {
  useListPractitioners,
  getListPractitionersQueryKey,
  useUpdatePractitioner,
  useCreatePractitioner,
  useListSpecialisms,
  getListSpecialismsQueryKey,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Plus, Pencil } from "lucide-react";

const EMPTY_FORM = {
  name: "",
  email: "",
  specialism: "",
  bio: "",
  sessionRateGbp: "",
  location: "",
  qualifications: "",
  avatarUrl: "",
  subscriptionStatus: "trial" as "active" | "inactive" | "trial",
};

export default function DashboardPractitioners() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: specialisms } = useListSpecialisms({
    query: { queryKey: getListSpecialismsQueryKey() }
  });
  const SPECIALISMS = (specialisms ?? []).map((s) => s.name);

  const updatePractitioner = useUpdatePractitioner();
  const createPractitioner = useCreatePractitioner();

  const { data: practitioners, isLoading, refetch } = useListPractitioners(
    {},
    { query: { queryKey: getListPractitionersQueryKey() } }
  );

  const isEditing = editingId !== null;

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (p: NonNullable<typeof practitioners>[number]) => {
    setEditingId(p.id);
    setForm({
      name: p.name ?? "",
      email: p.email ?? "",
      specialism: p.specialism ?? "",
      bio: p.bio ?? "",
      sessionRateGbp: p.sessionRateGbp != null ? String(p.sessionRateGbp) : "",
      location: p.location ?? "",
      qualifications: p.qualifications ?? "",
      avatarUrl: p.avatarUrl ?? "",
      subscriptionStatus: (p.subscriptionStatus ?? "trial") as "active" | "inactive" | "trial",
    });
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  };

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    updatePractitioner.mutate(
      { id, data: { isActive: !currentStatus } },
      {
        onSuccess: () => {
          toast({ title: "Status updated", description: `Practitioner is now ${!currentStatus ? "active" : "inactive"}.` });
          refetch();
        },
      }
    );
  };

  const handleChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const requiredOk = isEditing
      ? form.name && form.specialism && form.bio && form.sessionRateGbp
      : form.name && form.email && form.specialism && form.bio && form.sessionRateGbp;
    if (!requiredOk) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    if (isEditing && editingId !== null) {
      updatePractitioner.mutate(
        {
          id: editingId,
          data: {
            name: form.name,
            specialism: form.specialism,
            bio: form.bio,
            sessionRateGbp: Number(form.sessionRateGbp),
            location: form.location,
            qualifications: form.qualifications,
            avatarUrl: form.avatarUrl,
          },
        },
        {
          onSuccess: () => {
            toast({ title: "Practitioner updated", description: `${form.name}'s details have been saved.` });
            handleOpenChange(false);
            refetch();
          },
          onError: () => {
            toast({ title: "Error", description: "Could not save changes. Please try again.", variant: "destructive" });
          },
        }
      );
      return;
    }

    createPractitioner.mutate(
      {
        data: {
          name: form.name,
          email: form.email,
          specialism: form.specialism,
          bio: form.bio,
          sessionRateGbp: Number(form.sessionRateGbp),
          location: form.location || undefined,
          qualifications: form.qualifications || undefined,
          avatarUrl: form.avatarUrl || undefined,
          subscriptionStatus: form.subscriptionStatus,
          isActive: true,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Practitioner added", description: `${form.name} is now in the directory.` });
          handleOpenChange(false);
          refetch();
        },
        onError: () => {
          toast({ title: "Error", description: "Could not add practitioner. Check the email isn't already in use.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Practitioners Directory</h1>
          <p className="text-muted-foreground text-sm">Manage practitioner profiles and directory visibility.</p>
        </div>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Practitioner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">{isEditing ? "Edit Practitioner" : "Add New Practitioner"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
                  <Input id="name" placeholder="e.g. Hannah Smith" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email {!isEditing && <span className="text-destructive">*</span>}</Label>
                  <Input id="email" type="email" placeholder="hannah@example.com" value={form.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isEditing} />
                  {isEditing && <p className="text-xs text-muted-foreground">Email can't be changed.</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Specialism <span className="text-destructive">*</span></Label>
                  <Select value={form.specialism} onValueChange={(v) => handleChange("specialism", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select discipline" />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALISMS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate">Session Rate (£) <span className="text-destructive">*</span></Label>
                  <Input id="rate" type="number" min="0" step="5" placeholder="75" value={form.sessionRateGbp} onChange={(e) => handleChange("sessionRateGbp", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio <span className="text-destructive">*</span></Label>
                <Textarea id="bio" placeholder="A short description of the practitioner's background and approach..." rows={3} value={form.bio} onChange={(e) => handleChange("bio", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="location">Location</Label>
                  <Input id="location" placeholder="e.g. London, SE1" value={form.location} onChange={(e) => handleChange("location", e.target.value)} />
                </div>
                {!isEditing && (
                  <div className="space-y-1.5">
                    <Label>Subscription Status</Label>
                    <Select value={form.subscriptionStatus} onValueChange={(v) => handleChange("subscriptionStatus", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qualifications">Qualifications</Label>
                <Input id="qualifications" placeholder="e.g. REPs Level 3, YMCA Diploma" value={form.qualifications} onChange={(e) => handleChange("qualifications", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Profile photo</Label>
                <PhotoUpload value={form.avatarUrl} onChange={(url) => handleChange("avatarUrl", url)} />
                <p className="text-xs text-muted-foreground">Upload a headshot (JPG or PNG, up to 5MB).</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={isEditing ? updatePractitioner.isPending : createPractitioner.isPending}>
                  {isEditing
                    ? (updatePractitioner.isPending ? "Saving..." : "Save Changes")
                    : (createPractitioner.isPending ? "Adding..." : "Add Practitioner")}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Practitioner</TableHead>
                <TableHead>Specialism</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Directory Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-10 bg-muted animate-pulse rounded" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-24" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-16" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-20" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-12" /></TableCell>
                    <TableCell><div className="h-6 bg-muted animate-pulse rounded w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : practitioners?.length ? (
                practitioners.map((practitioner) => (
                  <TableRow key={practitioner.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-serif text-xs overflow-hidden shrink-0">
                          {practitioner.avatarUrl ? (
                            <img src={practitioner.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            practitioner.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{practitioner.name}</div>
                          <div className="text-xs text-muted-foreground">{practitioner.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm">{practitioner.specialism}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">£{practitioner.sessionRateGbp}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        practitioner.subscriptionStatus === "active" ? "bg-primary/10 text-primary border-primary/20" :
                        practitioner.subscriptionStatus === "trial" ? "bg-secondary/10 text-secondary border-secondary/20" :
                        "bg-muted text-muted-foreground"
                      }>
                        {practitioner.subscriptionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={practitioner.isActive}
                          onCheckedChange={() => handleToggleActive(practitioner.id, practitioner.isActive)}
                          disabled={updatePractitioner.isPending}
                        />
                        <span className="text-xs text-muted-foreground w-12">
                          {practitioner.isActive ? "Active" : "Hidden"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(practitioner)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No practitioners found. Add one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
