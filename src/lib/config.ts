export function demoMode() {
  const demo =
    (process.env.APP_MODE ??
      (process.env.NODE_ENV === "production" ? "production" : "demo")) ===
    "demo";
  if (demo && process.env.NODE_ENV === "production")
    throw new Error("El modo demo está prohibido en producción.");
  return demo;
}
const liveVariables: Record<string, string> = {
  DATABASE_URL: "DATABASE_LIVE_URL",
  DATABASE_SSL_CA: "DATABASE_LIVE_SSL_CA",
  NEXT_PUBLIC_SUPABASE_URL: "SUPABASE_LIVE_URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "SUPABASE_LIVE_ANON_KEY",
  WOMPI_PUBLIC_KEY: "WOMPI_LIVE_PUBLIC_KEY",
  WOMPI_PRIVATE_KEY: "WOMPI_LIVE_PRIVATE_KEY",
  WOMPI_EVENTS_SECRET: "WOMPI_LIVE_EVENTS_SECRET",
  WOMPI_INTEGRITY_SECRET: "WOMPI_LIVE_INTEGRITY_SECRET",
  TICKET_ENCRYPTION_KEY: "TICKET_LIVE_ENCRYPTION_KEY",
  SESSION_SECRET: "SESSION_LIVE_SECRET",
  WORKER_SECRET: "WORKER_LIVE_SECRET",
  EMAIL_FROM: "EMAIL_LIVE_FROM",
};

export function configured(name: string) {
  const profile = process.env.PASE_CONFIG_PROFILE;
  if (profile && profile !== "default" && profile !== "live")
    throw new Error("Perfil de configuración desconocido.");
  if (profile !== "live") return process.env[name];
  if (
    process.env.APP_MODE !== "production" ||
    process.env.APP_ENVIRONMENT !== "production" ||
    process.env.WOMPI_ENV !== "production"
  )
    throw new Error(
      "El perfil live requiere los tres ambientes de producción.",
    );
  // A missing live value must never fall back to a staging credential/database.
  return process.env[liveVariables[name] ?? name];
}

export function required(name: string) {
  const v = configured(name);
  if (!v) throw new Error(`Falta configuración del servidor: ${name}`);
  return v;
}
export function appUrl() {
  return process.env.APP_URL ?? "http://127.0.0.1:3000";
}
export function appEnvironment(): "demo" | "staging" | "production" {
  if (demoMode()) return "demo";
  return process.env.APP_ENVIRONMENT === "production" &&
    process.env.WOMPI_ENV === "production"
    ? "production"
    : "staging";
}
