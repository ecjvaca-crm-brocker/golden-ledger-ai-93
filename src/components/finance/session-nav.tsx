import { Link } from "@tanstack/react-router";
import { LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/use-session";

export function SessionNav() {
  const { user, loading } = useSession();
  if (loading) return null;

  return user ? (
    <Button asChild variant="secondary" size="sm">
      <Link to="/perfil">
        <UserRound className="mr-1.5 size-4" />
        Mi perfil
      </Link>
    </Button>
  ) : (
    <Button asChild variant="secondary" size="sm">
      <Link to="/auth">
        <LogIn className="mr-1.5 size-4" />
        Iniciar sesión
      </Link>
    </Button>
  );
}
