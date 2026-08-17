import { useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DocumentUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

export function DocumentUpload({ value, onChange, label }: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [fileName, setFileName] = useState("");
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (res) => onChange(`/api/storage${res.objectPath}`),
    onError: (err) =>
      toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.has(file.type)) {
      toast({ title: "Invalid file", description: "Please upload a PDF, Word document, or image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: "File too large", description: "Please choose a file under 10MB.", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    await uploadFile(file);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center border border-border">
        {value ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <FileText className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,image/*" className="hidden" onChange={handleFile} />
        <Button type="button" variant="outline" size="sm" disabled={isUploading} onClick={() => inputRef.current?.click()}>
          {isUploading ? (
            <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="h-4 w-4 mr-1.5" /> {value ? "Replace" : `Upload ${label}`}</>
          )}
        </Button>
        {value && !isUploading && (
          <>
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-secondary hover:underline">
              {fileName || "View file"}
            </a>
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setFileName(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}