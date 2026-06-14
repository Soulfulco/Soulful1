import { useState } from "react";
import {
  useListEventsForManagement,
  getListEventsForManagementQueryKey,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  listEventRegistrations,
  type Event as SoulfulEvent,
  type EventRegistration,
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PhotoUpload } from "@/components/PhotoUpload";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Users, CalendarDays } from "lucide-react";

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "",
  city: "",
  venue: "",
  address: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  priceGbp: "",
  imageUrl: "",
  organizer: "",
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardEvents() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<SoulfulEvent | null>(null);

  const [regsOpen, setRegsOpen] = useState(false);
  const [regsEvent, setRegsEvent] = useState<SoulfulEvent | null>(null);
  const [regs, setRegs] = useState<EventRegistration[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);

  const { data: events, isLoading, refetch } = useListEventsForManagement({
    query: { queryKey: getListEventsForManagementQueryKey() },
  });

  const createMut = useCreateEvent();
  const updateMut = useUpdateEvent();
  const deleteMut = useDeleteEvent();

  const isEditing = editingId !== null;

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (ev: SoulfulEvent) => {
    setEditingId(ev.id);
    setForm({
      title: ev.title ?? "",
      description: ev.description ?? "",
      category: ev.category ?? "",
      city: ev.city ?? "",
      venue: ev.venue ?? "",
      address: ev.address ?? "",
      startsAt: toLocalInput(ev.startsAt),
      endsAt: toLocalInput(ev.endsAt),
      capacity: ev.capacity != null ? String(ev.capacity) : "",
      priceGbp: ev.priceGbp != null ? String(ev.priceGbp) : "",
      imageUrl: ev.imageUrl ?? "",
      organizer: ev.organizer ?? "",
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

  const handleChange = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.city || !form.venue || !form.startsAt) {
      toast({ title: "Missing fields", description: "Title, description, city, venue and start time are required.", variant: "destructive" });
      return;
    }
    const payload = {
      title: form.title,
      description: form.description,
      category: form.category || undefined,
      city: form.city,
      venue: form.venue,
      address: form.address || undefined,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      capacity: form.capacity ? Number(form.capacity) : null,
      priceGbp: form.priceGbp ? Number(form.priceGbp) : 0,
      imageUrl: form.imageUrl || undefined,
      organizer: form.organizer || undefined,
    };

    if (isEditing && editingId !== null) {
      updateMut.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Event updated", description: `${form.title} has been saved.` });
            handleOpenChange(false);
            refetch();
          },
          onError: () => toast({ title: "Error", description: "Could not save the event.", variant: "destructive" }),
        }
      );
      return;
    }

    createMut.mutate(
      { data: payload },
      {
        onSuccess: () => {
          toast({ title: "Event created", description: `${form.title} is now live.` });
          handleOpenChange(false);
          refetch();
        },
        onError: () => toast({ title: "Error", description: "Could not create the event.", variant: "destructive" }),
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMut.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          toast({ title: "Event deleted", description: `${deleteTarget.title} has been removed.` });
          setDeleteTarget(null);
          refetch();
        },
        onError: () => toast({ title: "Error", description: "Could not delete the event.", variant: "destructive" }),
      }
    );
  };

  const openRegs = async (ev: SoulfulEvent) => {
    setRegsEvent(ev);
    setRegsOpen(true);
    setRegsLoading(true);
    try {
      const data = await listEventRegistrations(ev.id);
      setRegs(data);
    } catch {
      toast({ title: "Error", description: "Could not load registrations.", variant: "destructive" });
      setRegs([]);
    } finally {
      setRegsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-foreground">Events</h1>
          <p className="text-muted-foreground text-sm">Create and manage public events people can register for.</p>
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <Button className="gap-2" onClick={openAdd}>
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">{isEditing ? "Edit Event" : "Add New Event"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="title">Title <span className="text-destructive">*</span></Label>
                <Input id="title" placeholder="e.g. Soulful Chick'n'Chat" value={form.title} onChange={(e) => handleChange("title", e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
                <Textarea id="description" rows={3} placeholder="What's the event about?" value={form.description} onChange={(e) => handleChange("description", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" placeholder="e.g. Community" value={form.category} onChange={(e) => handleChange("category", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="organizer">Organiser</Label>
                  <Input id="organizer" placeholder="e.g. Soulful" value={form.organizer} onChange={(e) => handleChange("organizer", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City <span className="text-destructive">*</span></Label>
                  <Input id="city" placeholder="e.g. Bedford" value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="venue">Venue <span className="text-destructive">*</span></Label>
                  <Input id="venue" placeholder="e.g. Nandos Interchange" value={form.venue} onChange={(e) => handleChange("venue", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="Full address" value={form.address} onChange={(e) => handleChange("address", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="startsAt">Starts <span className="text-destructive">*</span></Label>
                  <Input id="startsAt" type="datetime-local" value={form.startsAt} onChange={(e) => handleChange("startsAt", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endsAt">Ends</Label>
                  <Input id="endsAt" type="datetime-local" value={form.endsAt} onChange={(e) => handleChange("endsAt", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input id="capacity" type="number" min="0" placeholder="Leave blank for unlimited" value={form.capacity} onChange={(e) => handleChange("capacity", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="priceGbp">Price (£)</Label>
                  <Input id="priceGbp" type="number" min="0" step="0.01" placeholder="0 for free" value={form.priceGbp} onChange={(e) => handleChange("priceGbp", e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Event image</Label>
                <PhotoUpload value={form.imageUrl} onChange={(url) => handleChange("imageUrl", url)} />
                <p className="text-xs text-muted-foreground">Optional banner image (JPG or PNG, up to 5MB).</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={isEditing ? updateMut.isPending : createMut.isPending}>
                  {isEditing
                    ? (updateMut.isPending ? "Saving..." : "Save Changes")
                    : (createMut.isPending ? "Creating..." : "Create Event")}
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
                <TableHead>Event</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(6).fill(0).map((_, j) => (
                      <TableCell key={j}><div className="h-6 bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : events?.length ? (
                events.map((ev) => (
                  <TableRow key={ev.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                          {ev.imageUrl ? <img src={ev.imageUrl} alt="" className="h-full w-full object-cover" /> : <CalendarDays className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{ev.title}</div>
                          {ev.category && <div className="text-xs text-muted-foreground capitalize">{ev.category}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(ev.startsAt)}</TableCell>
                    <TableCell className="text-sm">{ev.venue}, {ev.city}</TableCell>
                    <TableCell>
                      {ev.priceGbp > 0 ? <span className="text-sm font-medium">£{ev.priceGbp}</span> : <Badge variant="outline">Free</Badge>}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => openRegs(ev)} className="text-sm inline-flex items-center gap-1.5 text-primary hover:underline">
                        <Users className="h-3.5 w-3.5" />
                        {ev.registeredCount}{ev.capacity != null ? ` / ${ev.capacity}` : ""}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ev)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(ev)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No events yet. Add your first event to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={regsOpen} onOpenChange={setRegsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Registrations — {regsEvent?.title}</DialogTitle>
          </DialogHeader>
          {regsLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : regs.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.name}</TableCell>
                    <TableCell className="text-sm">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "registered" ? "default" : "outline"} className="capitalize">{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">No registrations yet.</div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{deleteTarget?.title}" and all of its registrations. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
