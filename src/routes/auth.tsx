import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Apple, Chrome, ShieldCheck, Grid2x2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/lib/use-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión | Consultoría financiera personal y de negocio" },
      {
        name: "description",
        content:
          "Accede con Google, Apple o Microsoft para guardar tu perfil financiero, presupuestos y metas de ahorro de forma segura.",
      },
      { property: "og:title", content: "Iniciar sesión | Consultoría financiera personal y de negocio" },
      {
        property: "og:description",
        content:
          "Accede con Google, Apple o Microsoft para guardar tu perfil financiero, presupuestos y metas de ahorro.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const PROVIDERS = [
  { id: "google" as const, label: "Continuar con Google", icon: Chrome },
  { id: "apple" as const, label: "Continuar con Apple", icon: Apple },
  { id: "microsoft" as const, label: "Continuar con Microsoft", icon: Grid2x2 },
];

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/perfil", replace: true });
  }, [loading, session, navigate]);

  const signIn = async (provider: "google" | "apple" | "microsoft") => {
    setPending(provider);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setPending(null);
      toast.error("No pudimos iniciar sesión. Intenta de nuevo.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/perfil", replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-md">
        <div className="navy-panel rounded-2xl p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            Consultoría financiera
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Accede a tu tablero financiero</h1>
          <p className="mt-2 text-sm text-primary-foreground/75">
            Guarda tu perfil, presupuestos, coberturas y metas de ahorro en un solo lugar.
          </p>
        </div>

        <div className="surface-card mt-5 space-y-3 p-6">
          {PROVIDERS.map((p) => (
            <Button
              key={p.id}
              variant="outline"
              className="w-full justify-start gap-3"
              disabled={pending !== null}
              onClick={() => signIn(p.id)}
            >
              <p.icon className="size-4" />
              {pending === p.id ? "Conectando…" : p.label}
            </Button>
          ))}
          <p className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-gold" />
            Solo usamos tu cuenta para identificarte. Tus datos financieros son privados y solo tú
            puedes verlos.
          </p>
        </div>
      </div>
    </div>
  );
}
