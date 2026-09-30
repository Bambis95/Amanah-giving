import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { adminApi } from "@/api";

// Same limit as the server (backend/routers/projects.py)
const MAX_PHOTOS = 12;
const MAX_MB = 12;

interface GalleryFieldProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

/** Extra campaign photos: several files at once, reorder, remove */
export default function GalleryField({ value, onChange }: GalleryFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = MAX_PHOTOS - value.length;
    const chosen = Array.from(files).filter((f) => f.type.startsWith("image/") && f.size <= MAX_MB * 1024 * 1024);
    if (chosen.length < files.length) toast.error(`Certains fichiers ont été ignorés (photos de ${MAX_MB} Mo max.)`);
    if (chosen.length > room) toast.error(`${MAX_PHOTOS} photos au maximum : les ${chosen.length - room} dernières sont ignorées`);
    const batch = chosen.slice(0, Math.max(room, 0));
    if (!batch.length) return;

    // One at a time: a slow connection (3G) handles it better than many uploads at once
    const added: string[] = [];
    setUploading({ done: 0, total: batch.length });
    for (const file of batch) {
      try {
        added.push((await adminApi.uploadImage(file)).url);
      } catch (error) {
        toast.error(`${file.name} : ${error instanceof Error ? error.message : "envoi impossible"}`);
      }
      setUploading({ done: added.length, total: batch.length });
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    if (added.length) {
      onChange([...value, ...added]);
      toast.success(`${added.length} photo${added.length > 1 ? "s" : ""} ajoutée${added.length > 1 ? "s" : ""} à la galerie`);
    }
  };

  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          Galerie <span className="font-normal text-muted-foreground">({value.length}/{MAX_PHOTOS})</span>
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => input.current?.click()}
          disabled={!!uploading || value.length >= MAX_PHOTOS}
        >
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          {uploading ? `Envoi ${uploading.done}/${uploading.total}…` : "Ajouter des photos"}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => add(e.target.files)}
      />

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          Photos du terrain, des bénéficiaires, de l'avancement… Elles s'affichent avec le texte complet de la campagne.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, i) => (
            <li key={`${url}-${i}`} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted">
              <img src={url} alt={`Photo ${i + 1} de la galerie`} className="h-full w-full object-cover" loading="lazy" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-destructive shadow-sm hover:bg-background"
                aria-label={`Retirer la photo ${i + 1}`}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 shadow-sm disabled:invisible"
                  aria-label={`Avancer la photo ${i + 1}`}
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 shadow-sm disabled:invisible"
                  aria-label={`Reculer la photo ${i + 1}`}
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
