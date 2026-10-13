export function demoMode() {
  const demo =
    (process.env.APP_MODE ??
      (process.env.NODE_ENV === "production" ? "production" : "demo")) ===
    "demo";
  if (demo && process.env.NODE_ENV === "production")
    throw new Error("El modo demo está prohibido en producción.");
  return demo;
}
export function required(name: string) {
  const v = process.env[name];
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
