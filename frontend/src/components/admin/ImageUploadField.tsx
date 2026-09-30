import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/api";
import { cn } from "@/lib/utils";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_MB = 12;

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
}

/**
 * Campaign photo: pick or drop a file (sent to the server, which resizes it), or paste an address.
 * The preview has the proportions of the public campaign card.
 */
export default function ImageUploadField({ value, onChange }: ImageUploadFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const send = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une photo (JPEG, PNG ou WebP)");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Photo trop lourde (${MAX_MB} Mo au maximum)`);
      return;
    }
    setUploading(true);
    try {
      const image = await adminApi.uploadImage(file);
      onChange(image.url);
      toast.success("Photo ajoutée");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'envoi de la photo a échoué");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = ""; // the same file can be chosen again
    }
  };

  return (
    <div className="space-y-2">
      <Label>Photo de la campagne</Label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          send(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex aspect-[2/1] w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 transition-colors",
          dragging ? "border-primary bg-accent" : "border-border"
        )}
      >
        {value ? (
          <img src={value} alt="Aperçu de la photo" className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={uploading}
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground hover:text-primary"
          >
            <ImagePlus className="h-8 w-8" aria-hidden="true" />
            <span className="font-medium">Choisir une photo</span>
            <span className="text-xs">ou la glisser ici · JPEG, PNG ou WebP, {MAX_MB} Mo max.</span>
          </button>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="sr-only">Envoi de la photo…</span>
          </div>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => send(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-2">
        {value && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />
              Changer la photo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange("")}
              disabled={uploading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Retirer
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={() => setShowUrl((v) => !v)} aria-expanded={showUrl}>
          <Link2 className="mr-2 h-4 w-4" />
          Adresse d'une image
        </Button>
      </div>
      {showUrl && (
        <Input
          aria-label="Adresse de l'image"
          placeholder="https://… ou /collectes/photo.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="text-xs text-muted-foreground">
        La photo est redimensionnée automatiquement ; les informations cachées du téléphone (position GPS…) sont
        supprimées.
      </p>
    </div>
  );
}
