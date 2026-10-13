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
  Music2,
  MapPin,
  ArrowRight,
  ShieldCheck,
  FileText,
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
export type State = Awaited<ReturnType<typeof state>>;
type Context = {
  data: State;
  busy: boolean;
  run: (body: Row, success?: string) => Promise<Row | null>;
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
      refresh().catch((e) => {
        if (active) setError(e.message);
      });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  const notify = (message: string, error = false) =>
    setToast({ message, error });
  async function run(body: Row, success = "Operación guardada") {
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
      notify(e instanceof Error ? e.message : "Error de conexión", true);
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
      ? [{ href: "/account/tickets", label: "Mis entradas", icon: Ticket }]
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
  else if (path === "/account" || path === "/account/tickets")
    screen = <Orders customer />;
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
                  <div className="avatar">
                    {data.actor.name.slice(0, 2).toUpperCase()}
                  </div>
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
    [pending, setPending] = useState(false);
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
      if (body.action === "signup") notify(b.message);
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
      <h1>{signup ? "Crea tu cuenta" : "Todo listo para entrar"}</h1>
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
            });
          }}
          className="section-stack"
          style={{ marginTop: 25 }}
        >
          {signup && <Field name="name" label="Nombre completo" />}
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
            {signup ? "Crear cuenta" : "Iniciar sesión"}
          </button>
          <button
            type="button"
            className="link"
            onClick={() => setSignup(!signup)}
          >
            {signup ? "Ya tengo una cuenta" : "Crear una cuenta de comprador"}
          </button>
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
                p.channel === "web" &&
                p.active &&
                new Date(p.starts_at) <= new Date() &&
                new Date(p.ends_at) > new Date(),
            )
            .map((p) => p.price_cop);
          return (
            <article className="event-card" key={e.id}>
              <a href={admin ? `/admin/events/${e.id}` : `/events/${e.slug}`}>
                <div className={`poster ${i % 2 ? "electronic" : ""}`}>
                  <small>PASE CENTRAL PRESENTA</small>
                  <div className="poster-title">
                    {e.title.replace(" · DEMO", "")}
                  </div>
                </div>
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
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState(""),
    [period, setPeriod] = useState("all");
  const events = data.events.filter(
    (e) =>
      data.permissions.manage.includes(e.id) &&
      (!selected || e.id === selected),
  );
  const ids = events.map((e) => e.id),
    since =
      period === "week"
        ? now - 7 * 86400000
        : period === "month"
          ? now - 30 * 86400000
          : 0;
  const orders = data.orders.filter(
      (o) =>
        ids.includes(o.event_id) && new Date(o.created_at).getTime() >= since,
    ),
    orderIds = orders.map((o) => o.id),
    tickets = data.tickets.filter((t) => orderIds.includes(t.order_id));
  const payments = data.payments.filter(
      (p) => orderIds.includes(p.order_id) && p.status === "approved",
    ),
    refunds = data.refunds
      .filter((r) => orderIds.includes(r.order_id))
      .reduce((sum, r) => sum + r.amount_cop, 0),
    collected = payments.reduce((s, p) => s + p.amount_cop, 0),
    valid = tickets.filter((t) => t.status !== "cancelled"),
    used = valid.filter((t) => t.status === "used").length,
    paid = tickets.filter((t) =>
      orders.some((o) => o.id === t.order_id && o.channel !== "complimentary"),
    ).length,
    comp = tickets.length - paid,
    reservations = orders.filter(
      (o) =>
        o.status === "pending_payment" &&
        new Date(o.reservation_expires_at) > new Date(),
    ).length;
  const series = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    const key = date.toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
    });
    return {
      date: key,
      label: date.toLocaleDateString("es-CO", {
        weekday: "short",
        timeZone: "America/Bogota",
      }),
      value: payments
        .filter(
          (p) =>
            new Date(p.created_at).toLocaleDateString("es-CO", {
              timeZone: "America/Bogota",
            }) === key,
        )
        .reduce((s, p) => s + p.amount_cop, 0),
    };
  });
  const max = Math.max(1, ...series.map((s) => s.value));
  return (
    <>
      <Heading
        title="Todo está bajo control"
        subtitle={`Hola, ${data.actor?.name}. Así van tus eventos.`}
        action={
          <a href="/admin/events/new" className="btn primary">
            <Plus />
            Crear evento
          </a>
        }
      />
      <div className="welcome">
        <div>
          <div className="eyebrow" style={{ color: "#b9d998" }}>
            BUENAS NOCHES EMPIEZAN CON BUENA GESTIÓN
          </div>
          <h2>Tú pones la fiesta. Nosotros, el pase.</h2>
          <p>
            Ventas, taquilla y acceso conectados. Cada evento con sus propios
            cupos, precios y equipo.
          </p>
        </div>
        <div className="art">
          <Ticket />
        </div>
      </div>
      {data.environment !== "production" && (
        <div className="notice">
          Indicadores del entorno de pruebas. No representan ventas reales ni
          dinero recibido en banco.
        </div>
      )}
      <div className="filterbar">
        <h2>Resumen de operación</h2>
        <div className="buttons">
          <select
            aria-label="Filtrar evento"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Todos los eventos</option>
            {data.events
              .filter((e) => data.permissions.manage.includes(e.id))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
          </select>
          <select
            aria-label="Filtrar periodo"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">Todo el periodo</option>
            <option value="week">Últimos 7 días</option>
            <option value="month">Últimos 30 días</option>
          </select>
        </div>
      </div>
      <div className="metrics">
        {[
          {
            label: "Cobros aprobados",
            value: money(collected),
            note: `Devoluciones registradas: ${money(refunds)}`,
            icon: Wallet,
          },
          {
            label: "Entradas vendidas",
            value: paid,
            note: `${comp} cortesías · ${reservations} reservas pendientes`,
            icon: Ticket,
          },
          {
            label: "Ingresos registrados",
            value: used,
            note: `${valid.length ? Math.round((used / valid.length) * 100) : 0}% de asistencia sobre entradas activas`,
            icon: ScanLine,
          },
          {
            label: "Cupos disponibles",
            value: events.reduce((s, e) => s + e.available, 0),
            note: `${events.length} eventos · cupos independientes`,
            icon: Users,
          },
        ].map((m) => (
          <article className="metric" key={m.label}>
            <div className="metric-top">
              {m.label}
              <m.icon />
            </div>
            <strong>{m.value}</strong>
            <small>{m.note}</small>
          </article>
        ))}
      </div>
      <div className="grid-main">
        <section className="panel">
          <div className="panel-head">
            <h2>Cobros de la semana</h2>
            <span className="badge gray">COP</span>
          </div>
          <div
            className="bar-chart"
            aria-label="Cobros aprobados de los últimos siete días"
          >
            {series.map((s) => (
              <div className="bar-group" key={s.date}>
                <div
                  className="bar"
                  style={{ height: `${Math.max(2, (s.value / max) * 85)}%` }}
                  title={`${s.date}: ${money(s.value)}`}
                />
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="chart-note">
            <span>
              <span className="status-dot" />
              Cobros aprobados
            </span>
            <b>Comisiones y conciliación bancaria pendientes</b>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>En tu agenda</h2>
            <a href="/admin/events">
              Ver todos
              <ArrowUpRight size={13} />
            </a>
          </div>
          {events.slice(0, 3).map((e, i) => (
            <a href={`/admin/events/${e.id}`} className="event-row" key={e.id}>
              <div className={`event-cover ${i % 2 ? "electronic" : ""}`}>
                <Music2 />
              </div>
              <div className="event-copy">
                <h3>{e.title}</h3>
                <p>
                  <CalendarDays />
                  {day(e.starts_at)} · {e.venue_name}
                </p>
              </div>
              <div className="event-side">
                <Badge status={e.status} />
                <strong>{e.available} cupos</strong>
              </div>
            </a>
          ))}
          {!events.length && <Empty>Tus eventos aparecerán aquí.</Empty>}
        </section>
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Últimas órdenes</h2>
          <a href="/admin/reports">
            Explorar reportes
            <ArrowUpRight size={13} />
          </a>
        </div>
        <OrderTable orders={orders.slice(0, 6)} />
        <div className="table-footer">
          <span>Datos del servidor · zona horaria de Bogotá</span>
          <span>
            {
              data.attempts.filter(
                (a) => ids.includes(a.event_id) && a.result !== "accepted",
              ).length
            }{" "}
            lecturas rechazadas
          </span>
        </div>
      </section>
      <div className="grid-main" style={{ marginTop: 22 }}>
        <section className="panel">
          <div className="panel-head">
            <h2>Por medio de pago</h2>
          </div>
          {["cash", "transfer", "checkout", "complimentary"].map((method) => (
            <div className="summary-line" key={method}>
              <span>
                {
                  {
                    cash: "Efectivo",
                    transfer: "Transferencia verificada",
                    checkout: "Online · Wompi",
                    complimentary: "Cortesías",
                  }[method]
                }
              </span>
              <b>
                {money(
                  payments
                    .filter((p) => p.method === method)
                    .reduce((s, p) => s + p.amount_cop, 0),
                )}
              </b>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>Alertas operativas</h2>
          </div>
          <p className="compact">
            {orders.filter((o) => o.status === "needs_review").length} pagos que
            requieren revisión
          </p>
          <p className="compact">
            {
              data.jobs.filter(
                (j) => orderIds.includes(j.order_id) && j.status === "failed",
              ).length
            }{" "}
            entregas de email fallidas
          </p>
          <p className="compact">
            {tickets.filter((t) => t.status === "cancelled").length} entradas
            anuladas
          </p>
          <a
            href="/admin/reports"
            className="btn small"
            style={{ marginTop: 18 }}
          >
            <FileText />
            Consultar incidencias
          </a>
        </section>
      </div>
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
