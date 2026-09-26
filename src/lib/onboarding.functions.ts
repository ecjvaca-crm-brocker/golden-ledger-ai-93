import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OnboardingInput, generateRoadmap, type Roadmap } from "./onboarding.server";

export type { Roadmap, RoadmapWeek, OnboardingAnswers } from "./onboarding.server";

export const createRoadmap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OnboardingInput.parse(input))
  .handler(async ({ data, context }): Promise<Roadmap> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Falta la configuración de IA.");
    const roadmap = await generateRoadmap(apiKey, data);
    const { error } = await context.supabase
      .from("onboarding")
      .upsert({ user_id: context.userId, answers: data, roadmap: { ...roadmap, hechas: [] } });
    if (error) throw new Error("No pudimos guardar tu hoja de ruta.");
    return roadmap;
  });
