import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/use-session";

export function SessionNav() {
  const { user, loading } = useSession();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("onboarding" as never)
      .select("user_id")
      .maybeSingle()
      .then(({ data, error }) => setPending(!error && !data));
  }, [user]);

  if (loading) return null;

  return user ? (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant={pending ? "default" : "secondary"} size="sm">
        <Link to="/bienvenida">
          <Compass className="mr-1.5 size-4" />
          {pending ? "Completa tu cuestionario" : "Mi hoja de ruta"}
        </Link>
      </Button>
      <Button asChild variant="secondary" size="sm">
        <Link to="/perfil">
          <UserRound className="mr-1.5 size-4" />
          Mi perfil
        </Link>
      </Button>
    </div>
  ) : (
    <Button asChild variant="secondary" size="sm">
      <Link to="/auth">
        <LogIn className="mr-1.5 size-4" />
        Iniciar sesión
      </Link>
    </Button>
  );
}
