import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers, type AdminUser } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Panel de administración | Usuarios registrados" },
      {
        name: "description",
        content:
          "Vista restringida para administradores: consulta usuarios registrados, tipo de cuenta, país y actividad financiera.",
      },
      { property: "og:title", content: "Panel de administración | Usuarios registrados" },
      {
        property: "og:description",
        content: "Consulta la base de usuarios registrados de la plataforma financiera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const fetchUsers = useServerFn(listUsers);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    fetchUsers({})
      .then((data) => active && setUsers(data))
      .catch((e: unknown) =>
        active && setError(e instanceof Error ? e.message : "No pudimos cargar los usuarios."),
      );
    return () => {
      active = false;
    };
  }, [fetchUsers]);

  const filtered = (users ?? []).filter((u) =>
    `${u.email} ${u.fullName ?? ""} ${u.country ?? ""} ${u.city ?? ""}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="navy-panel">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              Administración
            </p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
              <Users className="size-5 text-gold" /> Usuarios registrados
            </h1>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/perfil">
              <ArrowLeft className="mr-1.5 size-4" /> Mi perfil
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {error ? (
          <div className="surface-card flex items-center gap-3 p-6 text-sm">
            <ShieldAlert className="size-5 text-destructive" />
            {error}
          </div>
        ) : users === null ? (
          <div className="surface-card p-8 text-center text-sm text-muted-foreground">
            Cargando usuarios…
          </div>
        ) : (
          <div className="surface-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="text-sm font-semibold">{users.length} cuentas</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Base de datos de usuarios de la plataforma.
                </p>
              </div>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por correo, nombre o ciudad"
                className="w-full sm:w-72"
              />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Correo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Movimientos</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Último ingreso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.email}
                        {u.isAdmin ? (
                          <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gold">
                            admin
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.fullName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {u.accountType ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{u.entries}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString("es-CO")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {u.lastSignInAt
                          ? new Date(u.lastSignInAt).toLocaleDateString("es-CO")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
