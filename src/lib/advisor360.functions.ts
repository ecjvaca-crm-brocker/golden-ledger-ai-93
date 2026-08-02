import { createServerFn } from "@tanstack/react-start";
import {
  Advisor360Input,
  callAdvisor360,
  type Advisor360Result,
} from "./advisor360.server";

export type { Advisor360Result, Advisor360Gap, Advisor360Action } from "./advisor360.server";

export const diagnose360 = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Advisor360Input.parse(input))
  .handler(async ({ data }): Promise<Advisor360Result> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Falta la configuración de IA (LOVABLE_API_KEY).");
    return callAdvisor360(apiKey, data);
  });
