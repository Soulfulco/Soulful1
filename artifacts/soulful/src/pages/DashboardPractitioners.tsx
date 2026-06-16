import { useState } from "react";
import { rateSummary } from "@/lib/utils";
import {
  useListPractitioners,
  getListPractitionersQueryKey,
  useUpdatePractitioner,
  useCreatePractitioner,
  useBulkCreatePractitioners,
  useListSpecialisms,
  getListSpecialismsQueryKey,
  type PractitionerBulkItem,
  type PractitionerBulkResult,
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
import { Plus, Pencil, Upload, FileSpreadsheet } from "lucide-react";

const EMPTY_FORM = {
  name: "",
  email: "",
  specialism: "",
  bio: "",
  inPersonRateGbp: "",
  onlineRateGbp: "",
  location: "",
  qualifications: "",
  avatarUrl: "",
  subscriptionStatus: "trial" as "active" | "inactive" | "trial",
};

const HEADER_MAP: Record<string, keyof PractitionerBulkItem> = {
  name: "name",
  fullname: "name",
  email: "email",
  emailaddress: "email",
  specialism: "specialism",
  discipline: "specialism",
  specialty: "specialism",
  sessionrategbp: "sessionRateGbp",
  sessionrate: "sessionRateGbp",
  rate: "sessionRateGbp",
  price: "sessionRateGbp",
  inpersonrategbp: "inPersonRateGbp",
  inpersonrate: "inPersonRateGbp",
  inperson: "inPersonRateGbp",
  onlinerategbp: "onlineRateGbp",
  onlinerate: "onlineRateGbp",
  online: "onlineRateGbp",
  bio: "bio",
  biography: "bio",
  location: "location",
  city: "location",
  qualifications: "qualifications",
  qualification: "qualifications",
  quals: "qualifications",
};

const POSITIONAL: (keyof PractitionerBulkItem)[] = [
  "name",
  "email",
  "specialism",
  "sessionRateGbp",
  "bio",
  "location",
  "qualifications",
];

const normalizeHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function splitRow(line: string, delim: string): string[] {
  if (delim === "\t") return line.split("\t").map((c) => c.trim());
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseBulkInput(text: string): PractitionerBulkItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const delim = lines[0].includes("\t") ? "\t" : ",";
  const firstCells = splitRow(lines[0], delim).map(normalizeHeader);
  const hasHeader = firstCells.some((c) => HEADER_MAP[c] !== undefined);

  const columns: (keyof PractitionerBulkItem | null)[] = hasHeader
    ? firstCells.map((c) => HEADER_MAP[c] ?? null)
    : POSITIONAL;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cells = splitRow(line, delim);
    const row: Record<string, string> = {};
    columns.forEach((field, idx) => {
      if (field && cells[idx] !== undefined) row[field] = cells[idx].trim();
    });
    const inPerson = Number(String(row.inPersonRateGbp ?? "").replace(/[£,\s]/g, "")) || 0;
    const online = Number(String(row.onlineRateGbp ?? "").replace(/[£,\s]/g, "")) || 0;
    const session = Number(String(row.sessionRateGbp ?? "").replace(/[£,\s]/g, "")) || 0;
    const item: PractitionerBulkItem = {
      name: row.name ?? "",
      email: row.email ?? "",
      specialism: row.specialism ?? "",
      sessionRateGbp: session || inPerson || online,
    };
    if (inPerson) item.inPersonRateGbp = inPerson;
    if (online) item.onlineRateGbp = online;
    if (row.bio) item.bio = row.bio;
    if (row.location) item.location = row.location;
    if (row.qualifications) item.qualifications = row.qualifications;
    return item;
  });
}

export default function DashboardPractitioners() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<PractitionerBulkResult | null>(null);

  const { data: specialisms } = useListSpecialisms({
    query: { queryKey: getListSpecialismsQueryKey() }
  });
  const SPECIALISMS = (specialisms ?? []).map((s) => s.name);

  const updatePractitioner = useUpdatePractitioner();
  const createPractitioner = useCreatePractitioner();
  const bulkCreate = useBulkCreatePractitioners();

  const parsedBulk = parseBulkInput(bulkText);

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
      inPersonRateGbp: p.inPersonRateGbp != null ? String(p.inPersonRateGbp) : "",
      onlineRateGbp: p.onlineRateGbp != null ? String(p.onlineRateGbp) : "",
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
    const inPersonRate = form.inPersonRateGbp ? Number(form.inPersonRateGbp) : undefined;
    const onlineRate = form.onlineRateGbp ? Number(form.onlineRateGbp) : undefined;
    const baseRequired = isEditing
      ? form.name && form.specialism && form.bio
      : form.name && form.email && form.specialism && form.bio;
    if (!baseRequired) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    if (!inPersonRate && !onlineRate) {
      toast({ title: "Add a rate", description: "Enter an in-person rate, an online rate, or both.", variant: "destructive" });
      return;
    }
    const baseRate = (inPersonRate ?? onlineRate)!;

    if (isEditing && editingId !== null) {
      updatePractitioner.mutate(
        {
          id: editingId,
          data: {
            name: form.name,
            specialism: form.specialism,
            bio: form.bio,
            // Send null (not undefined) for a cleared rate so the API clears it;
            // the base sessionRateGbp is derived server-side from these two.
            inPersonRateGbp: inPersonRate ?? null,
            onlineRateGbp: onlineRate ?? null,
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
          sessionRateGbp: baseRate,
          inPersonRateGbp: inPersonRate,
          onlineRateGbp: onlineRate,
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

  const handleBulkOpenChange = (next: boolean) => {
    setBulkOpen(next);
    if (!next) {
      setBulkText("");
      setBulkResult(null);
    }
  };

  const handleBulkFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const handleBulkSubmit = () => {
    if (parsedBulk.length === 0) {
      toast({ title: "Nothing to import", description: "Paste rows or upload a CSV first.", variant: "destructive" });
      return;
    }
    bulkCreate.mutate(
      { data: { practitioners: parsedBulk } },
      {
        onSuccess: (result) => {
          setBulkResult(result);
          toast({
            title: "Import complete",
            description: `${result.created} added, ${result.skipped} skipped, ${result.invalid.length} invalid.`,
          });
          refetch();
        },
        onError: () => {
          toast({ title: "Import failed", description: "Could not import practitioners. Please try again.", variant: "destructive" });
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

        <div className="flex items-center gap-2">
        <Dialog open={bulkOpen} onOpenChange={handleBulkOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Bulk Import
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Bulk Import Practitioners</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
                <p>Paste rows from a spreadsheet, or upload a CSV file. The first row can be a header.</p>
                <p>
                  Columns: <span className="font-medium text-foreground">name, email, specialism</span> (required) plus <span className="font-medium text-foreground">inPersonRateGbp and/or onlineRateGbp</span> (at least one rate),
                  then <span className="font-medium text-foreground">bio, location, qualifications</span> (optional).
                </p>
                <p>Duplicate emails (already in the directory or repeated in the file) are skipped automatically.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulk-file" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" /> Upload CSV
                </Label>
                <Input
                  id="bulk-file"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={(e) => handleBulkFile(e.target.files?.[0])}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bulk-text">Or paste rows</Label>
                <Textarea
                  id="bulk-text"
                  rows={8}
                  className="font-mono text-xs"
                  placeholder={"name,email,specialism,inPersonRateGbp,onlineRateGbp,location\nHannah Smith,hannah@example.com,Yoga,75,60,London\nTom Lee,tom@example.com,Massage,80,,Bristol"}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                />
              </div>

              {parsedBulk.length > 0 && !bulkResult && (
                <div className="rounded-md border border-border overflow-hidden">
                  <div className="bg-muted/50 px-3 py-2 text-sm font-medium">{parsedBulk.length} row{parsedBulk.length === 1 ? "" : "s"} ready to import</div>
                  <div className="max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Specialism</TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedBulk.slice(0, 50).map((r, i) => (
                          <TableRow key={i}>
                            <TableCell>{r.name || <span className="text-destructive">—</span>}</TableCell>
                            <TableCell>{r.email || <span className="text-destructive">—</span>}</TableCell>
                            <TableCell>{r.specialism || <span className="text-destructive">—</span>}</TableCell>
                            <TableCell className="text-right">{r.sessionRateGbp ? `£${r.sessionRateGbp}` : <span className="text-destructive">—</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {bulkResult && (
                <div className="rounded-md border border-border p-3 text-sm space-y-2">
                  <div className="flex gap-4">
                    <span className="text-green-600 font-medium">{bulkResult.created} added</span>
                    <span className="text-muted-foreground">{bulkResult.skipped} skipped (duplicates)</span>
                    <span className="text-destructive">{bulkResult.invalid.length} invalid</span>
                  </div>
                  {bulkResult.invalid.length > 0 && (
                    <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5 max-h-32 overflow-y-auto">
                      {bulkResult.invalid.map((iv) => (
                        <li key={iv.row}>Row {iv.row}: {iv.reason}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => handleBulkOpenChange(false)}>
                  {bulkResult ? "Close" : "Cancel"}
                </Button>
                {!bulkResult && (
                  <Button onClick={handleBulkSubmit} disabled={parsedBulk.length === 0 || bulkCreate.isPending}>
                    {bulkCreate.isPending ? "Importing…" : `Import ${parsedBulk.length || ""}`.trim()}
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
                  <Label htmlFor="inPersonRate">In-person Rate (£)</Label>
                  <Input id="inPersonRate" type="number" min="0" step="5" placeholder="75" value={form.inPersonRateGbp} onChange={(e) => handleChange("inPersonRateGbp", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="onlineRate">Online Rate (£)</Label>
                  <Input id="onlineRate" type="number" min="0" step="5" placeholder="60" value={form.onlineRateGbp} onChange={(e) => handleChange("onlineRateGbp", e.target.value)} />
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
                      <span className="text-sm font-medium">{rateSummary(practitioner)}</span>
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
