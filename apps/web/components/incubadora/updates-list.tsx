"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "@/components/incubadora/markdown-view";
import { readFileAsDataURL, imageTooLarge, MAX_IMAGE_BYTES } from "@/lib/file";

export type UpdateItem = {
  id: string;
  body: string;
  author: { id: string; name: string; photo_url: string | null };
  attachments: { id: string; data: string; filename: string | null }[];
  created_at: string | null;
};

export function UpdatesList({
  updates,
  canPublish,
  onPublish,
}: {
  updates: UpdateItem[];
  canPublish: boolean;
  onPublish: (body: string, images: { filename: string; content_type: string; data: string; size: number }[]) => void;
}) {
  const [body, setBody] = useState("");
  const [images, setImages] = useState<{ filename: string; content_type: string; data: string; size: number }[]>([]);
  const [busy, setBusy] = useState(false);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (imageTooLarge(file)) continue;
      const data = await readFileAsDataURL(file);
      setImages((prev) => [
        ...prev,
        { filename: file.name, content_type: file.type || "image/png", data, size: file.size },
      ]);
    }
  };

  const publish = () => {
    if (!body.trim()) return;
    setBusy(true);
    onPublish(body.trim(), images);
    setBody("");
    setImages([]);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {updates.length === 0 && <p className="text-sm text-zinc-500">Aún no hay avances publicados.</p>}
      {updates.map((u) => (
        <div key={u.id} className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">{u.author?.name || "Autor"}</span>
            {u.created_at && <span className="text-xs text-zinc-400">{new Date(u.created_at).toLocaleDateString("es")}</span>}
          </div>
          <MarkdownView content={u.body} />
          {u.attachments?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {u.attachments.map((a) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={a.id} src={a.data} alt={a.filename || ""} className="h-24 w-24 rounded object-cover" />
              ))}
            </div>
          )}
        </div>
      ))}

      {canPublish && (
        <div className="space-y-2 rounded-md border border-emerald-200 p-4 dark:border-emerald-900/50">
          <h3 className="text-sm font-semibold">Publicar avance</h3>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Comparte el progreso del proyecto…"
            className="min-h-[90px]"
          />
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void addImages(e.target.files)}
            className="block w-full text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <button key={i} type="button" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))} title="Quitar">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.data} alt="" className="h-14 w-14 rounded object-cover" />
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={publish} disabled={busy || !body.trim()}>
              Publicar avance
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
