import { useRef } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  value: string;
  onChange: (url: string) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoUpload({ value, onChange }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (res) => onChange(`/api/storage${res.objectPath}`),
    onError: (err) =>
      toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please choose an image file.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Please choose an image under 5MB.", variant: "destructive" });
      return;
    }
    await uploadFile(file);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center border border-border">
        {value ? (
          <img src={value} alt="Profile preview" className="h-full w-full object-cover" />
        ) : (
          <User className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <div className="flex items-center gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          {isUploading ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="h-4 w-4 mr-1.5" /> {value ? "Replace photo" : "Upload photo"}</>
          )}
        </Button>
        {value && !isUploading && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <X className="h-4 w-4 mr-1" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
