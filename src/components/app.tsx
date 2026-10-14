"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useId,
  cloneElement,
  isValidElement,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Ticket,
  LayoutDashboard,
  CalendarDays,
  ShoppingBag,
  ScanLine,
  BarChart3,
  Users,
  ArrowUpRight,
  LogOut,
  Plus,
  Bell,
  ChevronRight,
  Wallet,
  MapPin,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { state } from "@/lib/state";
import type { Row } from "@/lib/db";
import { USERS } from "@/lib/seed";
import {
  EventEditor,
  BoxOffice,
  Access,
  Cash,
  Orders,
  Reports,
  UserManagement,
} from "./operations";
import { EventPurchase, Tickets, Checkout } from "./buyer";
import { Recovery } from "./recovery";
import { MyProfile, AcceptInvitation } from "./account";
import { AnalyticsPanel, initialAnalyticsFilters } from "./analytics";
import { MoneyInput } from "./enhanced-fields";
import { genders, ageBands } from "@/lib/demographics";
import { TicketWallet, Organizations } from "./ticket-wallet";
export type State = Awaited<ReturnType<typeof state>>;
type Context = {
  data: State;
  busy: boolean;
  run: (
    body: Row,
    success?: string,
    onError?: (message: string) => void,
  ) => Promise<Row | null>;
  refresh: () => Promise<void>;
  navigate: (path: string) => void;
  notify: (message: string, error?: boolean) => void;
};
const AppContext = createContext<Context | null>(null);
export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error("App context");
  return c;
}
export const money = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
export const when = (v: string | Date) =>
  new Date(v).toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
export const day = (v: string | Date) =>
  new Date(v).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
  });
const names: Record<string, string> = {
  accepted: "Aceptada",
  declined: "Rechazada",
  published: "En venta",
  draft: "Borrador",
  sales_closed: "Ventas cerradas",
  finished: "Finalizado",
  cancelled: "Anulada",
  confirmed: "Confirmada",
  pending_payment: "Pendiente de pago",
  expired: "Vencida",
  valid: "Vigente",
  used: "Utilizada",
  needs_review: "Requiere revisión",
  partially_refunded: "Devolución parcial",
  refunded: "Devuelta",
  approved: "Aprobado",
  sent: "Enviado",
  failed: "Fallido",
  pending: "Pendiente",
  processing: "Procesando",
};
export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge ${["pending_payment", "needs_review", "pending", "processing"].includes(status) ? "warning" : ["cancelled", "failed", "refunded"].includes(status) ? "bad" : ["draft", "expired", "used", "finished", "sales_closed"].includes(status) ? "gray" : ""}`}
    >
      {names[status] ?? status}
    </span>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <Ticket />
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  name,
  type = "text",
  value,
  required = true,
  children,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  children?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = `${name}-${useId()}`;
  return (
    <div>
      <label htmlFor={fieldId}>{label}</label>
      {children ? (
        isValidElement<{ id?: string }>(children) ? (
          cloneElement(children, { id: fieldId })
        ) : (
          children
        )
      ) : [
          "price_cop",
          "amount_cop",
          "opening_cash_cop",
          "declared_cash_cop",
        ].includes(name) ? (
        <MoneyInput
          id={fieldId}
          name={name}
          value={value ?? props.defaultValue}
          required={required}
          disabled={props.disabled}
          readOnly={props.readOnly}
        />
      ) : (
        <input
          id={fieldId}
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          {...props}
        />
      )}
    </div>
  );
}
export function Heading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="heading">
      <div>
        <div className="eyebrow">Pase Central / Gestión de eventos</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function App() {
  const path = usePathname(),
    router = useRouter();
  const [data, setData] = useState<State | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(
      null,
    );
  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    setData(body);
  }, []);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      async function initialize() {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        let destination: string | undefined;
        if (
          fragment.has("access_token") ||
          fragment.get("type") === "recovery" ||
          fragment.has("error")
        ) {
          const recovering = fragment.get("type") === "recovery";
          const access_token = fragment.get("access_token"),
            refresh_token = fragment.get("refresh_token");
          // Clear credentials before navigating or making any server request.
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
          destination = recovering
            ? "/forgot-password?invalid=1"
            : "/login?confirmation=invalid";
          if (access_token && refresh_token) {
            try {
              const response = await fetch("/api/auth", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "recovery",
                  access_token,
                  refresh_token,
                }),
              });
              if (response.ok)
                destination = recovering
                  ? "/reset-password"
                  : "/account/profile?confirmed=1";
            } catch {
              /* A network error never authenticates a recovery session. */
            }
          }
        }
        await refresh();
        if (active && destination) router.replace(destination);
      }
      initialize().catch((e) => {
        if (active) setError(e.message);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refresh, router]);
  const notify = (message: string, error = false) =>
    setToast({ message, error });
  async function run(
    body: Row,
    success = "Operación guardada",
    onError?: (message: string) => void,
  ) {
    setBusy(true);
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(
          result.error +
            (result.fields ? ` · ${result.fields.join(", ")}` : ""),
        );
      await refresh();
      if (success) notify(success);
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error de conexión";
      notify(message, true);
      onError?.(message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    await refresh();
    router.push("/login");
  }
  if (!data)
    return (
      <div className="loading">
        <div
          className="brand"
          style={{ color: "var(--green)", justifyContent: "center" }}
        >
          <Ticket /> pase central
        </div>
        <p>{error || "Preparando tu espacio…"}</p>
        {error && (
          <button className="btn" onClick={() => location.reload()}>
            Volver a intentar
          </button>
        )}
      </div>
    );
  const manage = data.permissions.manage.length > 0 || data.permissions.admin;
  const menu = [
    { href: "/events", label: "Explorar eventos", icon: CalendarDays },
    ...(data.actor
      ? [
          { href: "/account/profile", label: "Mi perfil", icon: Users },
          { href: "/account/tickets", label: "Mis entradas", icon: Ticket },
        ]
      : []),
  ];
  const operational = [
    ...(manage
      ? [
          { href: "/admin", label: "Vista general", icon: LayoutDashboard },
          { href: "/admin/events", label: "Mis eventos", icon: CalendarDays },
        ]
      : []),
    ...(data.permissions.sell.length
      ? [
          { href: "/box-office", label: "Taquilla", icon: ShoppingBag },
          { href: "/box-office/cash-session", label: "Caja", icon: Wallet },
        ]
      : []),
    ...(data.permissions.access.length
      ? [{ href: "/access", label: "Control de acceso", icon: ScanLine }]
      : []),
    ...(manage
      ? [
          { href: "/admin/reports", label: "Reportes", icon: BarChart3 },
          { href: "/admin/users", label: "Equipo y usuarios", icon: Users },
        ]
      : []),
  ];
  let screen: React.ReactNode;
  if (path === "/login") screen = <Login />;
  else if (path === "/forgot-password") screen = <Recovery />;
  else if (path === "/reset-password") screen = <Recovery reset />;
  else if (path.startsWith("/tickets/"))
    screen = <Tickets orderId={path.split("/")[2]} />;
  else if (path.startsWith("/checkout/"))
    screen = (
      <Checkout
        orderId={path.endsWith("/result") ? null : path.split("/")[2]}
      />
    );
  else if (path.startsWith("/events/"))
    screen = <EventPurchase slug={path.split("/")[2]} />;
  else if (path === "/events" || path === "/") screen = <Catalog />;
  else if (!data.actor)
    screen = (
      <div className="panel">
        <Empty>Inicia sesión para acceder a esta sección.</Empty>
        <a href="/login" className="btn primary">
          Iniciar sesión
        </a>
      </div>
    );
  else if (path === "/invite") screen = <AcceptInvitation />;
  else if (path === "/account/profile") screen = <MyProfile />;
  else if (path === "/account" || path === "/account/tickets")
    screen = <TicketWallet />;
  else if (path.startsWith("/account/orders/"))
    screen = <Orders customer orderId={path.split("/")[3]} />;
  else if (path === "/admin" && manage) screen = <Dashboard />;
  else if (path === "/admin/events" && manage) screen = <Catalog admin />;
  else if (path.startsWith("/admin/events/") && manage)
    screen = (
      <EventEditor
        eventId={path.split("/")[3] === "new" ? null : path.split("/")[3]}
        tab={path.split("/")[4]}
      />
    );
  else if (path === "/admin/reports" && manage) screen = <Reports />;
  else if (path === "/admin/users" && manage) screen = <UserManagement />;
  else if (path === "/admin/organizations" && data.permissions.admin)
    screen = <Organizations />;
  else if (path === "/box-office" && data.permissions.sell.length)
    screen = <BoxOffice />;
  else if (path === "/box-office/cash-session" && data.permissions.sell.length)
    screen = <Cash />;
  else if (path === "/access" && data.permissions.access.length)
    screen = <Access />;
  else screen = <Empty>No tienes acceso a esta sección.</Empty>;
  return (
    <AppContext.Provider
      value={{
        data,
        busy,
        run,
        refresh,
        navigate: (p) => router.push(p),
        notify,
      }}
    >
      <div className="shell">
        <aside className="sidebar">
          <a href="/events" className="brand">
            <span className="brand-icon">
              <Ticket size={22} />
            </span>
            <div>
              pase central<small>VIVE EL MOMENTO</small>
            </div>
          </a>
          {operational.length > 0 && (
            <>
              <div className="nav-label">Tu espacio de trabajo</div>
              <nav className="nav">
                {operational.map((m) => (
                  <a
                    key={m.href}
                    href={m.href}
                    className={
                      path === m.href ||
                      (m.href === "/admin/events" &&
                        path.startsWith("/admin/events/"))
                        ? "active"
                        : ""
                    }
                  >
                    <m.icon />
                    {m.label}
                  </a>
                ))}
              </nav>
            </>
          )}
          <div className="nav-label">Descubre y disfruta</div>
          {data.permissions.admin && (
            <nav className="nav">
              <a href="/admin/organizations">
                <Users />
                Organizaciones
              </a>
            </nav>
          )}
          <nav className="nav">
            {menu.map((m) => (
              <a
                key={m.href}
                href={m.href}
                className={path === m.href ? "active" : ""}
              >
                <m.icon />
                {m.label}
              </a>
            ))}
            {!data.actor && (
              <a href="/login" className={path === "/login" ? "active" : ""}>
                <ShieldCheck />
                Iniciar sesión
              </a>
            )}
          </nav>
          <div className="nav-foot">
            {data.actor ? (
              <>
                <div className="user">
                  {data.profile?.avatar_url ? (
                    <img
                      className="avatar"
                      src={data.profile.avatar_url}
                      alt="Tu foto de perfil"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div className="avatar">
                      {data.actor.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    {data.actor.name}
                    <small>
                      {manage ? "Administración" : "Sesión verificada"}
                    </small>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="btn small"
                  style={{
                    marginTop: 16,
                    background: "transparent",
                    color: "#b2c7ba",
                    borderColor: "#456052",
                  }}
                >
                  <LogOut />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <p>
                Tu próxima gran noche
                <br />
                empieza aquí.
              </p>
            )}
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span className="crumb">
              Tu espacio{" "}
              <ChevronRight
                style={{
                  display: "inline",
                  width: 12,
                  height: 12,
                  margin: "0 7px",
                }}
              />
              <b>
                {[...operational, ...menu].find((m) => m.href === path)
                  ?.label ?? "Pase Central"}
              </b>
            </span>
            <div className="top-right">
              {data.environment !== "production" && (
                <span className="demo-pill">
                  {data.demo ? "ENTORNO DEMO" : "PRUEBAS CONECTADAS"}
                </span>
              )}
              <span className="status">
                <span className="status-dot" />
                Datos del servidor
              </span>
              <Bell size={17} color="#748381" />
              <div className="avatar">
                {data.actor ? data.actor.name.slice(0, 1) : "PC"}
              </div>
            </div>
          </header>
          <main className="content">{screen}</main>
        </div>
      </div>
      {toast && (
        <div className={`toast ${toast.error ? "error" : ""}`} role="status">
          {toast.message}
          <button
            aria-label="Cerrar notificación"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
function Login() {
  const { data, refresh, navigate, notify } = useApp();
  const [signup, setSignup] = useState(false),
    [pending, setPending] = useState(false),
    [invited, setInvited] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const timer = setTimeout(() => {
      setInvited(
        params.get("invitation") === "1" ||
          !!sessionStorage.getItem("pc-invitation"),
      );
      if (params.get("register") === "1") setSignup(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  async function login(body: Row) {
    setPending(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error);
      await refresh();
      if (body.action === "signup")
        notify(
          invited
            ? "Cuenta creada. Confirma tu correo y continúa para activar los permisos de tu invitación."
            : b.message,
        );
      else if (
        b.next === "/invite" ||
        invited ||
        sessionStorage.getItem("pc-invitation")
      )
        navigate("/invite");
      else
        navigate(
          body.action === "demo" && [USERS[0].id, USERS[1].id].includes(body.id)
            ? "/admin"
            : body.action === "demo" && body.id === USERS[2].id
              ? "/box-office"
              : body.action === "demo" && body.id === USERS[3].id
                ? "/access"
                : "/events",
        );
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel login-panel">
      <div className="eyebrow">Bienvenido a Pase Central</div>
      <h1>
        {signup
          ? invited
            ? "Crea tu cuenta para unirte al equipo"
            : "Crea tu cuenta"
          : "Todo listo para entrar"}
      </h1>
      {invited && (
        <p className="notice">
          Usa el mismo correo que recibió la invitación. Después de confirmar tu
          correo, podrás activar el rol asignado; no se crea una cuenta de
          trabajo distinta ni debes elegir un rol.
        </p>
      )}
      {typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("account") ===
          "deleted" && (
          <p className="notice">
            Tu cuenta fue eliminada. Las entradas propias sin usar quedaron
            anuladas; no se realizó un reembolso automático.
          </p>
        )}
      {typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("confirmation") ===
          "invalid" && (
          <p role="alert" className="notice">
            El enlace de confirmación venció o ya fue utilizado. Intenta iniciar
            sesión con la cuenta que creaste; si tu correo aún no está
            confirmado, solicita ayuda al administrador.
          </p>
        )}
      <p>Administra tus noches. Guarda tus entradas. Vive el momento.</p>
      {data.demo ? (
        <>
          <div className="notice" style={{ marginTop: 22 }}>
            Demostración local. Los eventos, usuarios y pagos son ficticios.
            Elige un perfil para probar sus permisos.
          </div>
          <div className="demo-accounts">
            {USERS.map((u) => (
              <button
                className="btn"
                disabled={pending}
                key={u.id}
                onClick={() => login({ action: "demo", id: u.id })}
              >
                {u.name}
                <ArrowRight />
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login({
              action: signup ? "signup" : "login",
              ...Object.fromEntries(new FormData(e.currentTarget)),
              ...(signup
                ? {
                    terms_accepted: true,
                    age_band:
                      String(
                        new FormData(e.currentTarget).get("age_band") || "",
                      ) || null,
                  }
                : {}),
            });
          }}
          className="section-stack"
          style={{ marginTop: 25 }}
        >
          {signup && <Field name="name" label="Nombre completo" />}
          {signup && (
            <>
              <label className="field">
                <span>Género</span>
                <select
                  name="gender"
                  aria-label="Género"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Selecciona una opción
                  </option>
                  {Object.entries(genders).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Rango de edad (opcional)</span>
                <select
                  name="age_band"
                  aria-label="Rango de edad (opcional)"
                  defaultValue=""
                >
                  <option value="">Prefiero no indicar edad</option>
                  {Object.entries(ageBands).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="helper">
                Información declarada para estadísticas de organización. Puedes
                elegir “Prefiero no responder” y omitir la edad. No pedimos
                documentos ni fecha de nacimiento.
              </p>
              <label className="inline-check">
                <input type="checkbox" required />
                Acepto las{" "}
                <a href="/terms" target="_blank" rel="noreferrer">
                  condiciones de creación de cuenta
                </a>{" "}
                y el{" "}
                <a href="/privacy" target="_blank" rel="noreferrer">
                  aviso de privacidad
                </a>
                , incluido el uso estadístico de los datos declarados.
              </label>
            </>
          )}
          <Field
            name="email"
            type="email"
            label="Correo electrónico"
            autoComplete="email"
          />
          <Field
            name="password"
            type="password"
            label="Contraseña (mínimo 10 caracteres)"
            minLength={10}
            autoComplete={signup ? "new-password" : "current-password"}
          />
          <button className="btn primary" disabled={pending}>
            {signup
              ? invited
                ? "Crear cuenta y continuar con la invitación"
                : "Crear cuenta"
              : "Iniciar sesión"}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => setSignup(!signup)}
          >
            {signup
              ? "Ya tengo una cuenta"
              : invited
                ? "Crear cuenta para unirme al equipo"
                : "Crear una cuenta de comprador"}
          </button>
          {!signup && (
            <a className="link" href="/forgot-password">
              Olvidé mi contraseña
            </a>
          )}
        </form>
      )}
    </section>
  );
}
export function Catalog({ admin = false }: { admin?: boolean }) {
  const { data } = useApp();
  const [query, setQuery] = useState("");
  const events = data.events.filter(
    (e) =>
      (admin
        ? data.permissions.manage.includes(e.id)
        : e.status === "published") &&
      e.title.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <Heading
        title={
          admin
            ? "Tus eventos, en un solo lugar"
            : "Una entrada. Una gran noche."
        }
        subtitle={
          admin
            ? "Crea, prepara y administra cada fiesta de forma independiente."
            : "Encuentra tu próximo plan y asegura tu lugar."
        }
        action={
          admin && (
            <a className="btn primary" href="/admin/events/new">
              <Plus />
              Crear evento
            </a>
          )
        }
      />
      {data.demo && (
        <div className="notice">
          Eventos ficticios de demostración. Las fechas y cupos del primer
          evento real siguen pendientes.
        </div>
      )}
      <div className="filterbar">
        <input
          className="search"
          aria-label="Buscar eventos"
          placeholder="Buscar un evento…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="compact">
          {events.length} eventos {admin ? "en tu organización" : "disponibles"}
        </p>
      </div>
      <div className="event-grid">
        {events.map((e, i) => {
          const prices = data.phases
            .filter(
              (p) =>
                data.types.some(
                  (t) => t.id === p.ticket_type_id && t.event_id === e.id,
                ) &&
                ["web", "both"].includes(p.channel) &&
                p.active &&
                new Date(p.starts_at) <= new Date() &&
                new Date(p.ends_at) > new Date(),
            )
            .map((p) => p.price_cop);
          return (
            <article className="event-card" key={e.id}>
              <a href={admin ? `/admin/events/${e.id}` : `/events/${e.slug}`}>
                {e.cover_url ? (
                  <img
                    className="event-card-image"
                    src={e.cover_url}
                    alt={`Portada de ${e.title}`}
                  />
                ) : (
                  <div className={`poster ${i % 2 ? "electronic" : ""}`}>
                    <small>PASE CENTRAL PRESENTA</small>
                    <div className="poster-title">
                      {e.title.replace(" · DEMO", "")}
                    </div>
                  </div>
                )}
              </a>
              <div className="card-body">
                <div
                  className="buttons"
                  style={{ justifyContent: "space-between", marginBottom: 15 }}
                >
                  <Badge status={e.status} />
                  {data.demo && <small className="helper">DEMO</small>}
                </div>
                <h3>{e.title}</h3>
                <div className="card-meta">
                  <CalendarDays />
                  {when(e.starts_at)}
                </div>
                <div className="card-meta">
                  <MapPin />
                  {e.venue_name}
                </div>
                <div className="card-meta">
                  <Users />
                  {e.available} lugares disponibles
                </div>
                <div className="card-footer">
                  <div>
                    <small>
                      {prices.length ? "Desde" : "Configura los precios"}
                    </small>
                    <strong>
                      {prices.length ? money(Math.min(...prices)) : "—"}
                    </strong>
                  </div>
                  <a
                    className="btn primary"
                    href={admin ? `/admin/events/${e.id}` : `/events/${e.slug}`}
                  >
                    {admin ? "Administrar" : "Ver entradas"}
                    <ArrowUpRight />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!events.length && (
        <Empty>
          No encontramos eventos.{" "}
          {admin
            ? "Crea tu primera fiesta para comenzar."
            : "Vuelve pronto para conocer los próximos planes."}
        </Empty>
      )}
    </>
  );
}
export function Dashboard() {
  const { data } = useApp();
  const [filters, setFilters] = useState({ ...initialAnalyticsFilters });
  const managedOrders = data.orders.filter((o) =>
    data.permissions.manage.includes(o.event_id),
  );
  const orderIds = new Set(managedOrders.map((o) => o.id));
  const failedEmails = data.jobs.filter(
    (j) => orderIds.has(j.order_id) && j.status === "failed",
  ).length;
  return (
    <>
      <Heading
        title="Tus eventos, de un vistazo"
        subtitle="Ventas, público y resultados de tus eventos."
        action={
          <a className="btn primary" href="/admin/events/new">
            <Plus />
            Crear evento
          </a>
        }
      />
      {failedEmails > 0 && (
        <div className="notice" style={{ marginBottom: 20 }}>
          {failedEmails} entregas de email fallidas en tus eventos. Revisa la
          orden correspondiente para reenviar las entradas.
        </div>
      )}
      <AnalyticsPanel filters={filters} onChange={setFilters} />
      <section className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head">
          <h2>Últimas órdenes de tus eventos</h2>
          <a href="/admin/events">Administrar eventos</a>
        </div>
        <p className="helper">
          Lista reciente de todos tus eventos administrados, independiente de
          los filtros del análisis.
        </p>
        <OrderTable orders={managedOrders.slice(0, 6)} />
      </section>
    </>
  );
}
export function OrderTable({ orders }: { orders: Row[] }) {
  const { data } = useApp();
  return orders.length ? (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Orden / comprador</th>
            <th>Evento</th>
            <th>Canal</th>
            <th>Total</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.buyer_name || "Venta física anónima"}</strong>
                <div className="helper">{o.id.slice(0, 8).toUpperCase()}</div>
              </td>
              <td>{data.events.find((e) => e.id === o.event_id)?.title}</td>
              <td>
                {o.channel === "web"
                  ? "Online"
                  : o.channel === "box_office"
                    ? "Taquilla"
                    : "Cortesía"}
              </td>
              <td>
                <strong>{money(o.total_cop)}</strong>
              </td>
              <td>
                <Badge status={o.status} />
              </td>
              <td>{day(o.created_at)}</td>
              <td>
                <a
                  className="btn small"
                  href={
                    ["confirmed", "partially_refunded", "refunded"].includes(
                      o.status,
                    )
                      ? `/tickets/${o.id}`
                      : `/checkout/${o.id}`
                  }
                >
                  <ArrowUpRight />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty>Todavía no hay órdenes en este periodo.</Empty>
  );
}
