import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  country: string | null;
  city: string | null;
  age: number | null;
  accountType: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
  entries: number;
}

export const isAdminUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return Boolean(data);
  });

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Acceso restringido a administradores.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error("No pudimos leer la lista de usuarios.");

    const [{ data: profiles }, { data: roles }, { data: entries }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.from("entries").select("user_id"),
    ]);

    const counts = new Map<string, number>();
    for (const e of entries ?? []) counts.set(e.user_id, (counts.get(e.user_id) ?? 0) + 1);
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

    return authUsers.users.map((u) => {
      const p = (profiles ?? []).find((x) => x.id === u.id);
      return {
        id: u.id,
        email: u.email ?? "—",
        fullName: p?.full_name ?? null,
        country: p?.country ?? null,
        city: p?.city ?? null,
        age: p?.age ?? null,
        accountType: p?.account_type ?? null,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isAdmin: adminIds.has(u.id),
        entries: counts.get(u.id) ?? 0,
      };
    });
  });

export const migrateAccountData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ targetEmail: z.string().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw new Error("No pudimos verificar la cuenta destino.");

    const email = data.targetEmail.trim().toLowerCase();
    const target = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!target) throw new Error("La cuenta destino no existe. Pide que inicie sesión al menos una vez.");
    if (target.id === context.userId) throw new Error("La cuenta destino es la misma cuenta actual.");

    const tables = ["entries", "budgets", "bank_products", "savings_goals"] as const;
    let moved = 0;
    for (const table of tables) {
      const { data: rows, error: updErr } = await supabaseAdmin
        .from(table)
        .update({ user_id: target.id })
        .eq("user_id", context.userId)
        .select("id");
      if (updErr) throw new Error(`No pudimos migrar los datos de ${table}.`);
      moved += rows?.length ?? 0;
    }
    return { moved, targetEmail: email };
  });
