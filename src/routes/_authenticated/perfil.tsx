import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRightLeft, LogOut, ShieldCheck, Users, UserRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser, migrateAccountData } from "@/lib/admin.functions";
import { COUNTRIES, dialFor } from "@/lib/countries";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil | ESCALA Cash Flow" },
      {
        name: "description",
        content:
          "Registra tu nombre, país, ciudad, edad, tipo de cuenta y las coberturas de salud, vida, retiro e inversiones que tienes al día.",
      },
      { property: "og:title", content: "Mi perfil | ESCALA Cash Flow" },
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
  phone: z.string().trim().regex(/^\+?[0-9\s()-]{7,20}$/, "Ingresa un número de celular válido."),
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [targetEmail, setTargetEmail] = useState("");
  const [migrating, setMigrating] = useState(false);
  const checkAdmin = useServerFn(isAdminUser);
  const migrate = useServerFn(migrateAccountData);
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
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
        const dial = dialFor(data.country ?? "");
        let phone = (data.phone ?? "").replace(/\s/g, "");
        if (dial && phone.startsWith(dial)) phone = phone.slice(dial.length);
        setForm({
          full_name: data.full_name ?? "",
          phone: phone.replace(/[^0-9]/g, ""),
          country: data.country ?? "",
          city: data.city ?? "",
          age: data.age != null ? String(data.age) : "",
          account_type: data.account_type ?? "personal",
          coverage_health: data.coverage_health,
          coverage_life: data.coverage_life,
          coverage_retirement: data.coverage_retirement,
          coverage_investments: data.coverage_investments,
        });
      }
      try {
        const admin = await checkAdmin({});
        if (active) setIsAdmin(admin);
      } catch {
        /* sin rol admin */
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.country) {
      toast.error("Selecciona tu país.");
      return;
    }
    const parsed = schema.safeParse({
      full_name: form.full_name,
      phone: `${dialFor(form.country)}${form.phone}`,
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
    const { data: prev } = await supabase
      .from("profiles")
      .select("sheets_synced")
      .eq("id", user.id)
      .maybeSingle();
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
    if (!prev?.sheets_synced) {
      // Registro nuevo: enviar a Google Sheets en segundo plano (no bloquea)
      void (async () => {
        try {
          await fetch(
            "https://script.google.com/macros/s/AKfycbxIOsYkcuX-7WdRg1PoY0S5CM3j6CXOSwNTV9bF34XMo_IvOX6PWh_Ov0tLZHgfZppp/exec",
            {
              method: "POST",
              mode: "no-cors",
              headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({
                origen: "app_lovable",
                nombre: parsed.data.full_name,
                email: user.email ?? "",
                telefono: parsed.data.phone,
              }),
            },
          );
          await supabase.from("profiles").update({ sheets_synced: true }).eq("id", user.id);
        } catch (e) {
          console.warn("Webhook Google Sheets falló", e);
        }
      })();
    }
  };

  const runMigration = async () => {
    if (!targetEmail.trim()) {
      toast.error("Escribe el correo de la cuenta destino.");
      return;
    }
    setMigrating(true);
    try {
      const result = await migrate({ data: { targetEmail: targetEmail.trim() } });
      toast.success(`Migramos ${result.moved} registros a ${result.targetEmail}.`);
      setTargetEmail("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos migrar los datos.");
    } finally {
      setMigrating(false);
    }
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
                <Label className="text-xs">Correo electrónico</Label>
                <Input value={email} disabled className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs">País</Label>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecciona tu país</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.dial})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Celular *</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    value={dialFor(form.country) || "+"}
                    disabled
                    className="w-20 text-center"
                    aria-label="Prefijo del país"
                  />
                  <Input
                    type="tel"
                    inputMode="numeric"
                    required
                    value={form.phone}
                    maxLength={15}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, "") })
                    }
                    placeholder="991234567"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Ciudad</Label>
                <Input
                  value={form.city}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Quito"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs">Edad</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={form.age}
                  maxLength={3}
                  onChange={(e) => setForm({ ...form, age: e.target.value.replace(/[^0-9]/g, "") })}
                  placeholder="Escribe tu edad"
                  className="mt-1.5"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Tipo de cuenta</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["personal", "Personal"],
                      ["negocio", "Pequeño negocio"],
                    ] as const
                  ).map(([v, l]) => (
                    <Button
                      key={v}
                      type="button"
                      variant={form.account_type === v ? "default" : "outline"}
                      onClick={() => setForm({ ...form, account_type: v })}
                    >
                      {l}
                    </Button>
                  ))}
                </div>
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

        {!loading && (
          <section className="surface-card mt-6 space-y-3 p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ArrowRightLeft className="size-4 text-gold" /> Migrar datos a otra cuenta
            </h2>
            <p className="text-xs text-muted-foreground">
              Transfiere tus movimientos, presupuestos, productos bancarios y metas al correo
              indicado. La cuenta destino debe haber iniciado sesión al menos una vez.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="nuevo-correo@dominio.com"
              />
              <Button variant="outline" onClick={runMigration} disabled={migrating}>
                {migrating ? "Migrando…" : "Migrar datos"}
              </Button>
            </div>
          </section>
        )}

        {!loading && isAdmin && (
          <section className="surface-card mt-6 flex flex-wrap items-center justify-between gap-3 p-6">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-gold" /> Panel de administración
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Consulta los usuarios registrados y su actividad.
              </p>
            </div>
            <Button asChild>
              <Link to="/admin">Abrir panel</Link>
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
