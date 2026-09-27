import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImageUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHART_OF_ACCOUNTS, type Entry, type Scope } from "@/lib/finance";
import { scanReceipt, type ReceiptResult } from "@/lib/receipt.functions";

async function toDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ReceiptScanner({ onAdd }: { onAdd: (e: Omit<Entry, "id">) => void }) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const scan = useServerFn(scanReceipt);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReceiptResult | null>(null);

  const handle = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecciona una imagen.");
    setBusy(true);
    setDraft(null);
    try {
      const image = await toDataUrl(file);
      setPreview(image);
      setDraft(await scan({ data: { image } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos leer el comprobante.");
    } finally {
      setBusy(false);
      if (cam.current) cam.current.value = "";
      if (gal.current) gal.current.value = "";
    }
  };

  const save = () => {
    if (!draft || draft.amount <= 0 || !draft.description.trim())
      return toast.error("Revisa la descripción y el monto.");
    onAdd({ ...draft, description: draft.description.trim() });
    toast.success("Movimiento registrado desde imagen");
    setDraft(null);
    setPreview(null);
  };

  const set = (k: keyof ReceiptResult, v: string | number) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="surface-card space-y-4 p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Registro de movimientos por imagen</h3>
        <p className="text-sm text-muted-foreground">
          Toma una foto de tu factura, nota de venta o comprobante, o súbelo desde tu galería.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <input ref={cam} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => handle(e.target.files?.[0])} />
        <input ref={gal} type="file" accept="image/*" hidden
          onChange={(e) => handle(e.target.files?.[0])} />
        <Button type="button" disabled={busy} onClick={() => cam.current?.click()}>
          <Camera className="mr-1.5 size-4" /> Tomar foto
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => gal.current?.click()}>
          <ImageUp className="mr-1.5 size-4" /> Cargar desde galería
        </Button>
        {busy && (
          <span className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="mr-1.5 size-4 animate-spin" /> Leyendo comprobante…
          </span>
        )}
      </div>

      {draft && (
        <div className="grid gap-4 md:grid-cols-[160px_1fr]">
          {preview && <img src={preview} alt="Comprobante" className="max-h-56 rounded-lg border object-contain" />}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Descripción</Label>
              <Input className="mt-1" value={draft.description} maxLength={120}
                onChange={(e) => set("description", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Monto</Label>
              <Input className="mt-1" type="number" step="0.01" value={draft.amount}
                onChange={(e) => set("amount", Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">Fecha</Label>
              <Input className="mt-1" type="date" value={draft.date}
                onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Ámbito</Label>
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.scope} onChange={(e) => set("scope", e.target.value as Scope)}>
                <option value="personal">Personal</option>
                <option value="negocio">Negocio</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Cuenta (NIIF)</Label>
              <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={draft.accountCode} onChange={(e) => set("accountCode", e.target.value)}>
                {CHART_OF_ACCOUNTS.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" onClick={save}>Confirmar y registrar</Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setPreview(null); }}>
                Descartar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
