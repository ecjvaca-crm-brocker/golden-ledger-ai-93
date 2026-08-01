import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil financiero | Datos y coberturas" },
      {
        name: "description",
        content:
          "Registra tu nombre, país, ciudad, edad, tipo de cuenta y las coberturas de salud, vida, retiro e inversiones que tienes al día.",
      },
      { property: "og:title", content: "Mi perfil financiero | Datos y coberturas" },
      {
        property: "og:description",
        content:
          "Registra tus datos personales o de negocio y marca las coberturas que tienes actualizadas.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Ingresa tu nombre completo.").max(120),
  country: z.string().trim().min(2, "Ingresa tu país.").max(80),
  city: z.string().trim().min(2, "Ingresa tu ciudad.").max(80),
  age: z.number().int().min(16, "La edad debe ser mayor a 16.").max(110, "Edad no válida."),
});

const COVERAGES = [
  { key: "coverage_health", label: "Seguro de salud" },
  { key: "coverage_life", label: "Seguro de vida" },
  { key: "coverage_retirement", label: "Plan de retiro / pensión" },
  { key: "coverage_investments", label: "Inversiones" },
] as const;

type CoverageKey = (typeof COVERAGES)[number]["key"];

function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    country: "",
    city: "",
    age: "",
    account_type: "personal" as "personal" | "negocio",
    coverage_health: false,
    coverage_life: false,
    coverage_retirement: false,
    coverage_investments: false,
  });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      if (active) setEmail(user.email ?? "");
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) toast.error("No pudimos cargar tu perfil.");
      if (active && data) {
        setForm({
          full_name: data.full_name ?? "",
          country: data.country ?? "",
          city: data.city ?? "",
          age: data.age != null ? String(data.age) : "",
          account_type: data.account_type,
          coverage_health: data.coverage_health,
          coverage_life: data.coverage_life,
          coverage_retirement: data.coverage_retirement,
          coverage_investments: data.coverage_investments,
        });
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const parsed = schema.safeParse({
      full_name: form.full_name,
      country: form.country,
      city: form.city,
      age: Number(form.age),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setSaving(false);
      return;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      ...parsed.data,
      account_type: form.account_type,
      coverage_health: form.coverage_health,
      coverage_life: form.coverage_life,
      coverage_retirement: form.coverage_retirement,
      coverage_investments: form.coverage_investments,
    });
    setSaving(false);
    if (error) {
      toast.error("No pudimos guardar tu perfil.");
      return;
    }
    toast.success("Perfil actualizado");
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="navy-panel">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Mi cuenta</p>
            <h1 className="mt-2 text-2xl font-semibold">Perfil del titular</h1>
            {email ? (
              <p className="mt-1 text-sm text-primary-foreground/70">{email}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link to="/">
                <ArrowLeft className="mr-1.5 size-4" /> Tablero
              </Link>
            </Button>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogOut className="mr-1.5 size-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        {loading ? (
          <div className="surface-card p-8 text-center text-sm text-muted-foreground">
            Cargando tu perfil…
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <section className="surface-card grid gap-4 p-6 md:grid-cols-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold md:col-span-2">
                <UserRound className="size-4 text-gold" /> Datos del usuario o negocio
              </h2>
              <div className="md:col-span-2">
                <Label className="text-xs">Nombre completo / razón social</Label>
                <Input
                  value={form.full_name}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Nombre y apellido"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">País</Label>
                <Input
                  value={form.country}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="Colombia"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">Ciudad</Label>
                <Input
                  value={form.city}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Bogotá"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">Edad</Label>
                <Input
                  type="number"
                  min="16"
                  max="110"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="35"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">Tipo de cuenta</Label>
                <Select
                  value={form.account_type}
                  onValueChange={(v) =>
                    setForm({ ...form, account_type: v as "personal" | "negocio" })
                  }
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="negocio">Pequeño negocio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </section>

            <section className="surface-card space-y-3 p-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-gold" /> Coberturas actualizadas
              </h2>
              <p className="text-xs text-muted-foreground">
                Marca las coberturas que tienes vigentes; las usamos para afinar tus
                recomendaciones.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {COVERAGES.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-3 rounded-md border bg-secondary/50 p-3 text-sm"
                  >
                    <Checkbox
                      checked={form[c.key as CoverageKey]}
                      onCheckedChange={(v) => setForm({ ...form, [c.key]: v === true })}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </section>

            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar perfil"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
