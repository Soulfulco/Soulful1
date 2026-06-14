import { useState } from "react";
import {
  useListSpecialisms,
  getListSpecialismsQueryKey,
  useCreateSpecialism,
  useUpdateSpecialism,
  useDeleteSpecialism,
  type Specialism,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

export default function DashboardSpecialisms() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = getListSpecialismsQueryKey();

  const { data: specialisms = [], isLoading } = useListSpecialisms({ query: { queryKey } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createSpecialism = useCreateSpecialism();
  const updateSpecialism = useUpdateSpecialism();
  const deleteSpecialism = useDeleteSpecialism();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [toDelete, setToDelete] = useState<Specialism | null>(null);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createSpecialism.mutateAsync({ data: { name } });
      setNewName("");
      await invalidate();
      toast({ title: "Specialism added", description: `"${name}" is now available as a filter.` });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't add specialism",
        description: err instanceof Error && err.message.includes("409") ? "That specialism already exists." : "Please try again.",
      });
    }
  };

  const startEdit = (s: Specialism) => {
    setEditingId(s.id);
    setEditName(s.name);
  };

  const handleSaveEdit = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    try {
      await updateSpecialism.mutateAsync({ id, data: { name } });
      setEditingId(null);
      await invalidate();
      toast({ title: "Specialism updated" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't update specialism",
        description: err instanceof Error && err.message.includes("409") ? "That specialism already exists." : "Please try again.",
      });
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteSpecialism.mutateAsync({ id: toDelete.id });
      await invalidate();
      toast({ title: "Specialism removed", description: `"${toDelete.name}" is no longer a filter option.` });
    } catch {
      toast({ variant: "destructive", title: "Couldn't remove specialism", description: "Please try again." });
    } finally {
      setToDelete(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
          <Tag className="h-5 w-5 text-muted-foreground" />
          Specialisms
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage the disciplines practitioners can be tagged with. These power the filter on the public
          directory and the dropdowns in practitioner sign-up and admin forms.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Add a new specialism (e.g. Reiki)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="h-10"
          />
          <Button onClick={handleAdd} disabled={!newName.trim() || createSpecialism.isPending} className="shrink-0">
            {createSpecialism.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />}
            Add
          </Button>
        </div>
      </Card>

      <Card className="divide-y">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : specialisms.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">No specialisms yet. Add your first one above.</p>
        ) : (
          specialisms.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              {editingId === s.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveEdit(s.id);
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="h-9"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-primary"
                    onClick={() => handleSaveEdit(s.id)}
                    disabled={!editName.trim() || updateSpecialism.isPending}
                    title="Save"
                  >
                    {updateSpecialism.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground"
                    onClick={() => setEditingId(null)}
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => startEdit(s)}
                    title="Rename"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setToDelete(s)}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </Card>

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes it as a filter and dropdown option. Practitioners already tagged with this
              specialism keep their value, but it will no longer appear as a selectable option.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
