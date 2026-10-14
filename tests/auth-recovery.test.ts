import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  setSession: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
}));
const databaseQuery = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  supabase: async () => ({ auth }),
  demoLogin: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  database: async () => ({ query: databaseQuery }),
}));
import { POST } from "../src/app/api/auth/route";
import { GET } from "../src/app/auth/confirm/route";
const base = "https://example.test";
const request = (body: object, origin = base) =>
  new Request(`${base}/api/auth`, {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  databaseQuery.mockImplementation(async (sql: string) => ({
    rows: sql.includes("team_invitations") ? [] : [{ requests: 1 }],
  }));
  vi.stubEnv("APP_MODE", "production");
  vi.stubEnv("APP_URL", base);
});
afterEach(() => vi.unstubAllEnvs());
describe("recuperación de cuenta", () => {
  it("confirmación en otra pestaña retoma invitación por correo verificado sin conceder rol automáticamente", async () => {
    auth.verifyOtp.mockResolvedValue({
      error: null,
      data: { user: { id: "invited-id", email: "invited@example.test" } },
    });
    databaseQuery.mockResolvedValue({
      rows: [{ id: "pending-id", role: "platform_admin" }],
    });
    const r = await GET(
      new Request(
        `${base}/auth/confirm?type=signup&token_hash=fake-test-token`,
      ),
    );
    expect(r.headers.get("location")).toBe(`${base}/invite?confirmed=1`);
    expect(databaseQuery.mock.calls[0][1]).toEqual(["invited@example.test"]);
    expect(
      databaseQuery.mock.calls.every(
        ([sql]) => !String(sql).includes("INSERT"),
      ),
    ).toBe(true);
  });
  it("sin invitación propia conserva perfil y login solo retoma desde usuario confirmado de Supabase", async () => {
    auth.verifyOtp.mockResolvedValue({
      error: null,
      data: { user: { id: "id", email: "other@example.test" } },
    });
    expect(
      (
        await GET(
          new Request(
            `${base}/auth/confirm?type=signup&token_hash=fake-test-token`,
          ),
        )
      ).headers.get("location"),
    ).toBe(`${base}/account/profile?confirmed=1`);
    auth.signInWithPassword.mockResolvedValue({
      error: null,
      data: {
        user: {
          id: "id",
          email: "invited@example.test",
          email_confirmed_at: "2026-01-01",
        },
      },
    });
    databaseQuery.mockImplementation(async (sql: string) => ({
      rows: sql.includes("team_invitations")
        ? [{ id: "invitation-id", role: "platform_admin" }]
        : [{ requests: 1 }],
    }));
    const result = await POST(
      request({
        action: "login",
        email: "invited@example.test",
        password: "fictional-password-123",
      }),
    );
    expect((await result.json()).next).toBe("/invite");
  });
  it("confirma registro con datos opcionales y retorno al perfil, sin conceder roles de metadata", async () => {
    auth.signUp.mockResolvedValue({ error: null });
    const r = await POST(
      request({
        action: "signup",
        email: "test@example.test",
        password: "fictional-password-123",
        name: "Ficticio",
        gender: "prefer_not_to_say",
        terms_accepted: true,
        role: "platform_admin",
      }),
    );
    expect(r.status).toBe(200);
    expect(auth.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
      `${base}/auth/confirm?type=signup`,
    );
    expect(auth.signUp.mock.calls[0][0].options.data).not.toHaveProperty(
      "role",
    );
    expect(
      (
        await POST(
          request({
            action: "signup",
            email: "test@example.test",
            password: "fictional-password-123",
            name: "Ficticio",
            gender: "female",
            terms_accepted: false,
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("signup e invite válidos abren perfil en el servidor y eliminan credenciales de la URL", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    for (const type of ["signup", "invite"]) {
      const r = await GET(
        new Request(
          `${base}/auth/confirm?token_hash=test-token&type=${type}&next=https://external.test`,
        ),
      );
      expect(r.headers.get("location")).toBe(
        `${base}/account/profile?confirmed=1`,
      );
      expect(r.headers.get("cache-control")).toContain("no-store");
    }
  });
  it("rechaza una credencial de enlace implícito no válida", async () => {
    auth.setSession.mockResolvedValue({ error: new Error("invalid") });
    const r = await POST(
      request({
        action: "recovery",
        access_token: "invalid-access-token-example",
        refresh_token: "invalid-refresh-token",
      }),
    );
    expect(r.status).toBe(401);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("verifica identidad del enlace del dashboard antes de permitir recuperación", async () => {
    auth.setSession.mockResolvedValue({ error: null });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid identity"),
    });
    auth.signOut.mockResolvedValue({ error: null });
    const r = await POST(
      request({
        action: "recovery",
        access_token: "test-access-token-example",
        refresh_token: "test-refresh-token",
      }),
    );
    expect(r.status).toBe(401);
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rechaza cambio de contraseña sin identidad autenticada", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(
      (await POST(request({ action: "reset", password: "new-test-password" })))
        .status,
    ).toBe(401);
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it("rechaza solicitudes de cambio desde otro origen", async () => {
    expect(
      (
        await POST(
          request(
            { action: "reset", password: "new-test-password" },
            "https://other.test",
          ),
        )
      ).status,
    ).toBe(403);
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("sólo actualiza al usuario de la sesión y cierra su sesión", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "verified-user" } },
      error: null,
    });
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    const r = await POST(
      request({
        action: "reset",
        password: "new-test-password",
        user_id: "someone-else",
      }),
    );
    expect(r.status).toBe(200);
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "new-test-password",
    });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });
  it("solicita correo con retorno configurado sin confirmar existencia de cuenta", async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    const r = await POST(
      request({ action: "forgot", email: "test@example.test" }),
    );
    expect(r.status).toBe(200);
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "test@example.test",
      { redirectTo: `${base}/auth/confirm?type=recovery` },
    );
    expect((await r.json()).message).toContain("Si existe una cuenta");
  });
  it("rechaza un enlace vencido sin permitir redirección externa", async () => {
    auth.verifyOtp.mockResolvedValue({ error: new Error("expired") });
    const r = await GET(
      new Request(
        `${base}/auth/confirm?token_hash=expired-test-token&type=recovery&next=https://other.test`,
      ),
    );
    expect(r.headers.get("location")).toBe(`${base}/forgot-password?invalid=1`);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });
  it("intercambia código PKCE válido y abre formulario sin conservar credencial en URL", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const r = await GET(
      new Request(
        `${base}/auth/confirm?code=test-code&next=https://other.test`,
      ),
    );
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    expect(r.headers.get("location")).toBe(`${base}/reset-password`);
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("no intercambia tokens con tipo desconocido", async () => {
    const r = await GET(
      new Request(
        `${base}/auth/confirm?token_hash=test-token&type=unsupported`,
      ),
    );
    expect(auth.verifyOtp).not.toHaveBeenCalled();
    expect(r.headers.get("location")).toBe(
      `${base}/login?confirmation=invalid`,
    );
  });
});
