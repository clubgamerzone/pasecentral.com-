import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { memoryDb, type DB } from "../src/lib/db";
import { seed, USERS } from "../src/lib/seed";
import { execute, one, ticketDocument, settle } from "../src/lib/service";
import { state } from "../src/lib/state";
import { hash, decrypt } from "../src/lib/crypto";
import { normalizeAvatar } from "../src/lib/avatar";
import { normalizeEventImage } from "../src/lib/event-images";
import { resetTestData } from "../src/lib/test-reset";
import sharp from "sharp";
import { csv } from "../src/lib/csv";
import { verifyWebhook } from "../src/lib/wompi";
import { deliver } from "../src/lib/delivery";
import { ticketPdf } from "../src/lib/pdf";
import { PDFDocument } from "pdf-lib";
let db: DB;
const admin = USERS[0],
  box = USERS[2],
  access = USERS[3],
  customer = USERS[4];
const e1 = "00000000-0000-4000-8000-000000000002",
  e2 = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  db = await memoryDb();
});
beforeEach(async () => {
  await db.query("TRUNCATE organizations,profiles CASCADE");
  await seed(db);
});

describe("Permisos combinados y gestión de equipo por evento", () => {
  it("invitación pendiente propia se retoma sin token local y exige correo confirmado coincidente", async () => {
    const created = await execute(db, admin, {
      action: "invite_create",
      name: "Admin prueba",
      email: customer.email,
      role: "platform_admin",
      event_ids: [],
    });
    const own = await state(db, customer);
    expect(own.permissions.admin).toBe(false);
    expect(own.pending_invitation?.id).toBe(created.invitation_id);
    expect(JSON.stringify(own.pending_invitation)).not.toMatch(
      /token|encrypted/,
    );
    expect((await state(db, box)).pending_invitation).toBeNull();
    await expect(
      execute(db, box, {
        action: "invite_accept_pending",
        invitation_id: created.invitation_id,
      }),
    ).rejects.toThrow("verificada");
    await expect(
      execute(
        db,
        { ...customer, email_verified: false },
        {
          action: "invite_accept_pending",
          invitation_id: created.invitation_id,
        },
      ),
    ).rejects.toThrow("verificada");
    await execute(db, customer, {
      action: "invite_accept_pending",
      invitation_id: created.invitation_id,
    });
    expect((await state(db, customer)).permissions.admin).toBe(true);
    expect((await state(db, customer)).pending_invitation).toBeNull();
  });
  it("cajero invitado obtiene acceso solo con la casilla y la edición lo retira sin afectar ventas", async () => {
    const invitation = await execute(db, admin, {
      action: "invite_create",
      name: "Equipo prueba",
      email: customer.email,
      role: "box_office",
      include_access: true,
      event_ids: [e1, e2],
    });
    const row = await one(db, "SELECT * FROM team_invitations WHERE id=$1", [
      invitation.invitation_id,
    ]);
    expect(decrypt(row.email_payload_encrypted)).toContain("lector QR");
    await execute(db, customer, {
      action: "invite_accept",
      token: decrypt(row.token_encrypted),
    });
    expect((await state(db, customer)).permissions.access).toEqual(
      expect.arrayContaining([e1, e2]),
    );
    await execute(db, admin, {
      action: "team_update",
      user_id: customer.id,
      assignments: [{ event_id: e1, roles: ["box_office"] }],
    });
    const after = await state(db, customer);
    expect(after.permissions.sell).toContain(e1);
    expect(after.permissions.access).not.toContain(e1);
    expect(after.permissions.access).toContain(e2);
    await execute(db, customer, {
      action: "invite_accept",
      token: decrypt(row.token_encrypted),
    });
    expect((await state(db, customer)).permissions.access).not.toContain(e1);
  });
  it("taquilla sin incluir acceso no valida y no admite casilla para otros roles", async () => {
    const invitation = await execute(db, admin, {
      action: "invite_create",
      name: "Caja",
      email: customer.email,
      role: "box_office",
      event_ids: [e1],
    });
    const row = await one(db, "SELECT * FROM team_invitations WHERE id=$1", [
      invitation.invitation_id,
    ]);
    await execute(db, customer, {
      action: "invite_accept",
      token: decrypt(row.token_encrypted),
    });
    expect((await state(db, customer)).permissions.access).not.toContain(e1);
    await expect(
      execute(db, admin, {
        action: "invite_create",
        name: "Inválida",
        email: box.email,
        role: "access_staff",
        include_access: true,
        event_ids: [e1],
      }),
    ).rejects.toThrow("solo aplica");
  });
  it("administrador de evento invita solo en sus eventos y aceptación rechaza al perder el gestor su permiso", async () => {
    await execute(db, admin, {
      action: "staff",
      event_id: e1,
      user_id: customer.id,
      role: "organizer",
      active: true,
    });
    await expect(
      execute(db, customer, {
        action: "invite_create",
        name: "Otro",
        email: box.email,
        role: "box_office",
        event_ids: [e2],
      }),
    ).rejects.toThrow("permiso");
    await expect(
      execute(db, customer, {
        action: "invite_create",
        name: "Global",
        email: box.email,
        role: "platform_admin",
        event_ids: [],
      }),
    ).rejects.toThrow("administrador global");
    const invitation = await execute(db, customer, {
      action: "invite_create",
      name: "Caja",
      email: box.email,
      role: "box_office",
      include_access: true,
      event_ids: [e1],
    });
    const row = await one(db, "SELECT * FROM team_invitations WHERE id=$1", [
      invitation.invitation_id,
    ]);
    expect(
      (
        await one(
          db,
          "SELECT app_private.inviter_authorized($1,$2,$3) AS allowed",
          [customer.id, [e1], "box_office"],
        )
      ).allowed,
    ).toBe(true);
    await execute(db, admin, {
      action: "staff",
      event_id: e1,
      user_id: customer.id,
      role: "organizer",
      active: false,
    });
    await expect(
      execute(db, box, {
        action: "invite_accept",
        token: decrypt(row.token_encrypted),
      }),
    ).rejects.toThrow("ya no está autorizada");
  });
  it("edición valida todos los eventos antes de guardar y protege nombres y administradores globales", async () => {
    await execute(db, admin, {
      action: "staff",
      event_id: e1,
      user_id: customer.id,
      role: "organizer",
      active: true,
    });
    await expect(
      execute(db, customer, {
        action: "team_update",
        user_id: box.id,
        assignments: [
          { event_id: e1, roles: [] },
          { event_id: e2, roles: [] },
        ],
      }),
    ).rejects.toThrow("permiso");
    expect((await state(db, box)).permissions.sell).toContain(e1);
    await expect(
      execute(db, customer, {
        action: "team_update",
        user_id: box.id,
        name: "Editado",
        assignments: [{ event_id: e1, roles: [] }],
      }),
    ).rejects.toThrow("administrador global");
    await expect(
      execute(db, customer, {
        action: "team_update",
        user_id: admin.id,
        assignments: [{ event_id: e1, roles: [] }],
      }),
    ).rejects.toThrow("administrador global");
    await execute(db, customer, {
      action: "team_update",
      user_id: box.id,
      assignments: [{ event_id: e1, roles: ["box_office", "access_staff"] }],
    });
    expect((await state(db, box)).permissions.access).toContain(e1);
    await execute(db, customer, {
      action: "team_update",
      user_id: box.id,
      assignments: [{ event_id: e1, roles: [] }],
    });
    expect((await state(db, box)).permissions.sell).not.toContain(e1);
  });
  it("último administrador protegido y permisos heredados de organización permanecen explícitos", async () => {
    await expect(
      execute(db, admin, {
        action: "team_update",
        user_id: admin.id,
        platform_admin: false,
        assignments: [],
      }),
    ).rejects.toThrow("último administrador");
    await execute(db, admin, {
      action: "team_update",
      user_id: customer.id,
      name: "Nombre equipo",
      platform_admin: true,
      assignments: [],
    });
    expect((await state(db, customer)).permissions.admin).toBe(true);
    await execute(db, admin, {
      action: "team_update",
      user_id: customer.id,
      platform_admin: false,
      assignments: [],
    });
    expect((await state(db, customer)).permissions.admin).toBe(false);
    await execute(db, admin, {
      action: "team_update",
      user_id: USERS[1].id,
      assignments: [{ event_id: e1, roles: [] }],
    });
    const result = await state(db, USERS[1]);
    expect(result.permissions.manage).toContain(e1);
    expect(
      result.people.find((p) => p.id === USERS[1].id)?.managing_organizations,
    ).toHaveLength(1);
  });
  it("estado y RLS de invitaciones excluyen otro evento y función privilegiada no es pública", async () => {
    await execute(db, admin, {
      action: "staff",
      event_id: e1,
      user_id: customer.id,
      role: "organizer",
      active: true,
    });
    const visible = await execute(db, admin, {
      action: "invite_create",
      name: "Uno",
      email: box.email,
      role: "box_office",
      event_ids: [e1],
    });
    await execute(db, admin, {
      action: "invite_create",
      name: "Dos",
      email: access.email,
      role: "access_staff",
      event_ids: [e2],
    });
    await execute(db, admin, {
      action: "invite_create",
      name: "Ambos",
      email: USERS[1].email,
      role: "organizer",
      event_ids: [e1, e2],
    });
    expect((await state(db, customer)).invitations.map((i) => i.id)).toEqual([
      visible.invitation_id,
    ]);
    await db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE authenticated");
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        customer.id,
      ]);
      expect(
        (await tx.query("SELECT id FROM team_invitations")).rows.map(
          (i) => i.id,
        ),
      ).toEqual([visible.invitation_id]);
      expect(
        (
          await one(
            tx,
            "SELECT has_function_privilege('authenticated','app_private.inviter_authorized(uuid,uuid[],text)','EXECUTE') AS allowed",
          )
        ).allowed,
      ).toBe(false);
    });
    await expect(
      execute(db, customer, {
        action: "invite_revoke",
        invitation_id: (
          await one(db, "SELECT id FROM team_invitations WHERE email=$1", [
            access.email,
          ])
        ).id,
      }),
    ).rejects.toThrow("permiso");
  });
});
afterAll(async () => {
  await (db as DB & { close(): Promise<void> }).close();
});
async function type(event = e1) {
  return (
    await one(db, "SELECT id FROM ticket_types WHERE event_id=$1 AND name=$2", [
      event,
      "General",
    ])
  ).id as string;
}
async function sell(qty = 1, event = e1, method = "transfer") {
  return execute(db, box, {
    action: "sell",
    event_id: event,
    items: [{ ticket_type_id: await type(event), quantity: qty }],
    method,
    verified: true,
    reference: "VERIFICADA-DEMO",
    idempotency_key: randomUUID(),
  });
}
async function reserve(qty = 1, event = e1) {
  return execute(db, customer, {
    action: "reserve",
    event_id: event,
    items: [{ ticket_type_id: await type(event), quantity: qty }],
    buyer_name: "Comprador ficticio",
    buyer_email: "buyer@example.test",
    idempotency_key: randomUUID(),
  });
}
async function paid(orderId: string, status = "APPROVED") {
  const o = await one(db, "SELECT total_cop FROM orders WHERE id=$1", [
    orderId,
  ]);
  return db.transaction((tx) =>
    settle(tx, {
      orderId,
      transactionId: `TEST-${orderId}`,
      amount: o.total_cop * 100,
      currency: "COP",
      status,
    }),
  );
}
async function scan(
  credential: string,
  event = e1,
  request = randomUUID(),
  actor = access,
) {
  return execute(db, actor, {
    action: "checkin",
    event_id: event,
    credential,
    request_id: request,
    device_id: "TEST",
    gate_label: "Puerta test",
  });
}
describe("Inventario, precios y emisión transaccional", () => {
  it("no limpia eventos vinculados a una invitación de trabajador pendiente", async () => {
    await execute(db, admin, {
      action: "invite_create",
      name: "Cajero",
      email: "worker@example.test",
      role: "box_office",
      event_ids: [e1],
    });
    await expect(resetTestData(db, [e1, e2], async () => {})).rejects.toThrow(
      "invitaciones pendientes",
    );
    expect((await db.query("SELECT id FROM events")).rows).toHaveLength(2);
    expect(
      (await db.query("SELECT status FROM team_invitations")).rows[0].status,
    ).toBe("pending");
  });
  it("limpia ensayos con respaldo obligatorio, preserva cuentas e invitación global y rechaza eventos reales", async () => {
    await execute(db, admin, {
      action: "invite_create",
      name: "Trabajador",
      email: "worker@example.test",
      role: "platform_admin",
      event_ids: [],
    });
    await sell(1);
    const before = (
      await db.query("SELECT count(*)::int AS count FROM profiles")
    ).rows[0].count;
    await expect(
      resetTestData(db, [e1, e2], async () => {
        throw new Error("Respaldo falló");
      }),
    ).rejects.toThrow("Respaldo falló");
    expect((await db.query("SELECT id FROM orders")).rows).toHaveLength(1);
    const result = await resetTestData(db, [e1, e2], async (data) => {
      expect(data.tickets).toHaveLength(1);
    });
    expect(result.accountsPreserved).toBe(before);
    expect((await db.query("SELECT id FROM events")).rows).toHaveLength(0);
    expect((await db.query("SELECT id FROM profiles")).rows).toHaveLength(
      before,
    );
    expect(
      (await db.query("SELECT id FROM team_invitations")).rows,
    ).toHaveLength(1);
    expect((await state(db, admin)).permissions.admin).toBe(true);
    await seed(db);
    await db.query("UPDATE events SET title='Evento real' WHERE id=$1", [e1]);
    await expect(resetTestData(db, [e1, e2], async () => {})).rejects.toThrow(
      "DEMO",
    );
  });
  it("comprador reserva sin invitación y no puede ser invitado ni por API ni en PostgreSQL", async () => {
    expect(
      (await db.query("SELECT id FROM team_invitations")).rows,
    ).toHaveLength(0);
    const order = await reserve(1);
    expect(
      (
        await one(db, "SELECT buyer_user_id FROM orders WHERE id=$1", [
          order.order_id,
        ])
      ).buyer_user_id,
    ).toBe(customer.id);
    await expect(
      execute(db, admin, {
        action: "invite_create",
        name: "Comprador",
        email: "buyer@example.test",
        role: "customer",
        event_ids: [],
      }),
    ).rejects.toThrow();
    await expect(
      db.query(
        "INSERT INTO team_invitations(email,name,role,token_hash,token_encrypted,created_by,email_payload_encrypted) VALUES('buyer@example.test','Comprador','customer','dummy','dummy',$1,'dummy')",
        [admin.id],
      ),
    ).rejects.toThrow();
  });
  async function editEvent(
    changes: Record<string, unknown> = {},
    actor = admin,
  ) {
    const e = await one(db, "SELECT * FROM events WHERE id=$1", [e1]);
    const fields = [
      "title",
      "description",
      "venue_name",
      "address",
      "capacity",
      "starts_at",
      "ends_at",
      "admission_starts_at",
      "admission_ends_at",
    ];
    const values = Object.fromEntries(
      fields.map((k) => [k, e[k] instanceof Date ? e[k].toISOString() : e[k]]),
    );
    return execute(db, actor, {
      action: "update_event",
      event_id: e1,
      ...values,
      ...changes,
    });
  }
  it("localidad agotada aumenta cupo, conserva venta histórica y no reduce bajo vendidos/reservados", async () => {
    const id = await type();
    await execute(db, admin, {
      action: "update_type",
      event_id: e1,
      ticket_type_id: id,
      name: "General",
      capacity: 2,
    });
    await sell(1);
    const reservation = await reserve(1);
    await expect(
      execute(db, admin, {
        action: "update_type",
        event_id: e1,
        ticket_type_id: id,
        name: "Otro",
        capacity: 1,
      }),
    ).rejects.toThrow("comprometidas");
    await execute(db, admin, {
      action: "update_type",
      event_id: e1,
      ticket_type_id: id,
      name: "General ampliada",
      capacity: 4,
    });
    expect(
      (await state(db, null)).types.find((t) => t.id === id),
    ).toMatchObject({ capacity: 4, committed: 2 });
    expect(
      (
        await one(
          db,
          "SELECT type_name FROM order_items WHERE ticket_type_id=$1 LIMIT 1",
          [id],
        )
      ).type_name,
    ).toBe("General");
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 minute' WHERE id=$1",
      [reservation.order_id],
    );
    await execute(db, admin, {
      action: "update_type",
      event_id: e1,
      ticket_type_id: id,
      name: "General ampliada",
      capacity: 1,
    });
    expect(
      (
        await one(db, "SELECT status FROM orders WHERE id=$1", [
          reservation.order_id,
        ])
      ).status,
    ).toBe("expired");
  });
  it("reducción concurrente y venta mantienen el cupo", async () => {
    const id = await type();
    await sell(1);
    const results = await Promise.allSettled([
      execute(db, admin, {
        action: "update_type",
        event_id: e1,
        ticket_type_id: id,
        name: "General",
        capacity: 1,
      }),
      sell(1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const t = (await state(db, null)).types.find((t) => t.id === id)!;
    expect(t.committed).toBeLessThanOrEqual(t.capacity);
  });
  it("edita descripción/fechas y aforo sin cambiar enlace ni otro evento; rechaza aforo inválido", async () => {
    await editEvent({
      title: "Evento ampliado",
      description: "Línea uno\nLínea dos",
      capacity: 250,
    });
    expect(
      await one(db, "SELECT title,capacity FROM events WHERE id=$1", [e1]),
    ).toMatchObject({ title: "Evento ampliado", capacity: 250 });
    expect(
      (await one(db, "SELECT title FROM events WHERE id=$1", [e2])).title,
    ).not.toBe("Evento ampliado");
    await expect(editEvent({ capacity: 1 })).rejects.toThrow("localidades");
    await expect(
      editEvent({ ends_at: "2000-01-01T00:00:00Z" }),
    ).rejects.toThrow("posteriores");
  });
  it("comprador y taquilla no editan eventos/cupos; tipo ajeno rechazado; cupo cero permitido sin ventas", async () => {
    await expect(editEvent({}, customer)).rejects.toThrow("permiso");
    await expect(editEvent({}, box)).rejects.toThrow("permiso");
    const id = await type();
    await expect(
      execute(db, box, {
        action: "update_type",
        event_id: e1,
        ticket_type_id: id,
        name: "General",
        capacity: 1,
      }),
    ).rejects.toThrow("permiso");
    await expect(
      execute(db, admin, {
        action: "update_type",
        event_id: e1,
        ticket_type_id: await type(e2),
        name: "General",
        capacity: 1,
      }),
    ).rejects.toThrow("no encontrado");
    await execute(db, admin, {
      action: "update_type",
      event_id: e1,
      ticket_type_id: id,
      name: "General",
      capacity: 0,
    });
    await expect(reserve(1)).rejects.toThrow();
  });
  it("imágenes de borrador protegidas por RLS y portada restringida al evento", async () => {
    await db.query("UPDATE events SET status='draft' WHERE id=$1", [e2]);
    const image = await one(
      db,
      "INSERT INTO event_images(event_id,path,created_by) VALUES($1,$2,$3) RETURNING id",
      [e2, `${e2}/test.webp`, admin.id],
    );
    await expect(
      execute(db, admin, {
        action: "event_cover",
        event_id: e1,
        image_id: image.id,
      }),
    ).rejects.toThrow("no encontrado");
    await execute(db, admin, {
      action: "event_cover",
      event_id: e2,
      image_id: image.id,
    });
    expect((await state(db, null)).events.some((e) => e.id === e2)).toBe(false);
    await db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE anon");
      expect((await tx.query("SELECT * FROM event_images")).rows).toHaveLength(
        0,
      );
    });
    await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        customer.id,
      ]);
      await tx.query("SET LOCAL ROLE authenticated");
      await expect(
        tx.query(
          "INSERT INTO event_images(event_id,path,created_by) VALUES($1,'bad',$2)",
          [e1, customer.id],
        ),
      ).rejects.toThrow();
    });
  });
  it("procesa foto sin deformarla y bloquea formatos inseguros", async () => {
    const png = await sharp({
      create: { width: 2400, height: 1200, channels: 3, background: "#315eff" },
    })
      .png()
      .toBuffer();
    const image = await normalizeEventImage(png),
      meta = await sharp(image).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 2000, height: 1000 });
    await expect(
      normalizeEventImage(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      ),
    ).rejects.toThrow("SVG");
  });
  it("perfil cambia solo su propietario y no concede permisos", async () => {
    await execute(db, customer, {
      action: "profile_update",
      name: "Nombre de prueba",
      phone: "3000000000",
      bio: "Mi perfil",
      id: admin.id,
      role: "platform_admin",
    });
    expect(
      (await one(db, "SELECT name FROM profiles WHERE id=$1", [customer.id]))
        .name,
    ).toBe("Nombre de prueba");
    expect(
      (await one(db, "SELECT name FROM profiles WHERE id=$1", [admin.id])).name,
    ).toBe(admin.name);
    expect((await state(db, customer)).permissions.admin).toBe(false);
    expect((await state(db, customer)).profile?.bio).toBe("Mi perfil");
  });
  it("avatar normaliza imagen y rechaza SVG o archivos falsos", async () => {
    const source = await sharp({
      create: { width: 32, height: 48, channels: 3, background: "#123456" },
    })
      .jpeg()
      .toBuffer();
    const metadata = await sharp(await normalizeAvatar(source)).metadata();
    expect(metadata).toMatchObject({ width: 256, height: 256, format: "png" });
    await expect(normalizeAvatar(Buffer.from("<svg></svg>"))).rejects.toThrow(
      "válida",
    );
    await expect(
      normalizeAvatar(Buffer.alloc(2 * 1024 * 1024 + 1)),
    ).rejects.toThrow("2 MB");
  });
  it("invitar exige gestión del evento y correo verificado; rol y eventos vienen de invitación", async () => {
    const command = {
      action: "invite_create",
      name: "Invitado de prueba",
      email: "customer@example.test",
      role: "organizer",
      event_ids: [e1],
    };
    await expect(execute(db, box, command)).rejects.toThrow(
      "No tienes permiso",
    );
    const r = await execute(db, admin, command);
    const row = await one(db, "SELECT * FROM team_invitations WHERE id=$1", [
      r.invitation_id,
    ]);
    const credential = decrypt(row.token_encrypted);
    await expect(
      execute(
        db,
        { ...customer, email: "otra@example.test", email_verified: true },
        { action: "invite_accept", token: credential },
      ),
    ).rejects.toThrow("correo invitado");
    await expect(
      execute(
        db,
        { ...customer, email: "customer@example.test", email_verified: false },
        { action: "invite_accept", token: credential },
      ),
    ).rejects.toThrow("verificada");
    await execute(
      db,
      { ...customer, email: "customer@example.test", email_verified: true },
      {
        action: "invite_accept",
        token: credential,
        role: "platform_admin",
        event_ids: [e2],
      },
    );
    const result = await state(db, customer);
    expect(result.permissions.manage).toEqual([e1]);
    expect(result.permissions.admin).toBe(false);
    expect(result.permissions.access).toEqual([e1]);
    expect(
      await execute(
        db,
        { ...customer, email: "customer@example.test", email_verified: true },
        { action: "invite_accept", token: credential },
      ),
    ).toMatchObject({ accepted: true });
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM event_staff WHERE user_id=$1",
          [customer.id],
        )
      ).n,
    ).toBe(1);
    expect(JSON.stringify(await state(db, admin))).not.toContain(
      "token_encrypted",
    );
    await db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE authenticated");
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        customer.id,
      ]);
      expect(
        (await tx.query("SELECT id FROM team_invitations")).rows,
      ).toHaveLength(1);
    });
  });
  it("invitación revocada, vencida o de admin retirado no asigna roles", async () => {
    for (const kind of ["revoked", "expired", "creator_removed"]) {
      await db.query(
        "UPDATE team_invitations SET status='revoked' WHERE status='pending'",
      );
      const r = await execute(db, admin, {
        action: "invite_create",
        name: "Acceso invitado",
        email: "customer@example.test",
        role: "access_staff",
        event_ids: [e1, e2],
      });
      const i = await one(db, "SELECT * FROM team_invitations WHERE id=$1", [
        r.invitation_id,
      ]);
      if (kind === "revoked")
        await execute(db, admin, {
          action: "invite_revoke",
          invitation_id: i.id,
        });
      if (kind === "expired")
        await db.query(
          "UPDATE team_invitations SET expires_at=now()-interval '1 minute' WHERE id=$1",
          [i.id],
        );
      if (kind === "creator_removed")
        await db.query("DELETE FROM platform_admins WHERE user_id=$1", [
          admin.id,
        ]);
      await expect(
        execute(
          db,
          { ...customer, email: "customer@example.test", email_verified: true },
          { action: "invite_accept", token: decrypt(i.token_encrypted) },
        ),
      ).rejects.toThrow();
      expect((await state(db, customer)).permissions.access).toEqual([]);
    }
  });
  it("invitación asigna varias fiestas, y cola/email quedan protegidos", async () => {
    const r = await execute(db, admin, {
      action: "invite_create",
      name: "Invitado",
      email: "customer@example.test",
      role: "box_office",
      event_ids: [e1, e2, e1],
    });
    await deliver(db);
    const i = await one(db, "SELECT * FROM team_invitations WHERE id=$1", [
      r.invitation_id,
    ]);
    expect(i.email_status).toBe("sent");
    await execute(
      db,
      { ...customer, email: "customer@example.test", email_verified: true },
      { action: "invite_accept", token: decrypt(i.token_encrypted) },
    );
    expect((await state(db, customer)).permissions.sell.sort()).toEqual(
      [e1, e2].sort(),
    );
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query("SELECT token_encrypted FROM team_invitations");
      }),
    ).rejects.toThrow(/permission denied/);
  });
  it("separa cupos y órdenes entre dos eventos", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    await sell();
    await expect(sell()).rejects.toThrow("cupo");
    expect(await sell(1, e2)).toHaveProperty("order_id");
  });
  it("no permite mezclar localidades de otro evento", async () => {
    await expect(
      execute(db, box, {
        action: "sell",
        event_id: e1,
        items: [{ ticket_type_id: await type(e2), quantity: 1 }],
        method: "transfer",
        verified: true,
        reference: "REF",
        idempotency_key: randomUUID(),
      }),
    ).rejects.toThrow();
  });
  it("conserva precios anteriores y distingue canales", async () => {
    const r = await reserve();
    await db.query(
      "UPDATE pricing_phases SET price_cop=60000 WHERE ticket_type_id=$1 AND channel=$2",
      [await type(), "web"],
    );
    const second = await reserve();
    expect(
      (await one(db, "SELECT total_cop FROM orders WHERE id=$1", [r.order_id]))
        .total_cop,
    ).toBe(45000);
    expect(
      (
        await one(db, "SELECT total_cop FROM orders WHERE id=$1", [
          second.order_id,
        ])
      ).total_cop,
    ).toBe(60000);
    const s = await sell();
    expect(
      (await one(db, "SELECT total_cop FROM orders WHERE id=$1", [s.order_id]))
        .total_cop,
    ).toBe(55000);
  });
  it("rechaza fases activas superpuestas", async () => {
    await expect(
      execute(db, admin, {
        action: "add_phase",
        event_id: e1,
        ticket_type_id: await type(),
        name: "Otra",
        channel: "web",
        price_cop: 1,
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 60000).toISOString(),
      }),
    ).rejects.toThrow("superpuestas");
  });
  it("ventas concurrentes no exceden el aforo", async () => {
    await db.query("UPDATE events SET capacity=2 WHERE id=$1", [e1]);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => sell()),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM tickets WHERE event_id=$1",
          [e1],
        )
      ).n,
    ).toBe(2);
  });
  it("reservas concurrentes no exceden cupo de localidad", async () => {
    await db.query("UPDATE ticket_types SET capacity=1 WHERE id=$1", [
      await type(),
    ]);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => reserve()),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("coordina confirmación y vencimiento sin sobreventa", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const r = await reserve();
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await Promise.allSettled([paid(r.order_id), sell()]);
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM tickets WHERE event_id=$1",
          [e1],
        )
      ).n,
    ).toBe(1);
  });
  it("marca pago tardío sin inventario para revisión", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const r = await reserve();
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await sell();
    expect(await paid(r.order_id)).toEqual({ status: "needs_review" });
    expect(
      (
        await db.query(
          "SELECT * FROM tickets t JOIN order_items i ON i.id=t.order_item_id WHERE i.order_id=$1",
          [r.order_id],
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("confirma pago tardío con inventario una sola vez", async () => {
    const r = await reserve(3);
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await Promise.all([paid(r.order_id), paid(r.order_id)]);
    const doc = await ticketDocument(db, customer, r.order_id);
    expect(doc.tickets).toHaveLength(3);
    expect(new Set(doc.tickets.map((t) => t.credential)).size).toBe(3);
    expect(new Set(doc.tickets.map((t) => t.security_serial)).size).toBe(3);
  });
  it("reintenta venta idempotente sin duplicar ni recobrar", async () => {
    const command = {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 2 }],
      method: "transfer",
      verified: true,
      reference: "REF",
      idempotency_key: randomUUID(),
    };
    const [a, b] = await Promise.all([
      execute(db, box, command),
      execute(db, box, command),
    ]);
    expect(a.order_id).toBe(b.order_id);
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(2);
  });
  it("cortesías consumen cupo y requieren organizador", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const command = {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 1 }],
      method: "complimentary",
      reason: "Invitado autorizado",
      idempotency_key: randomUUID(),
    };
    await expect(execute(db, box, command)).rejects.toThrow("permiso");
    const r = await execute(db, admin, command);
    expect(
      (await one(db, "SELECT total_cop FROM orders WHERE id=$1", [r.order_id]))
        .total_cop,
    ).toBe(0);
    await expect(sell()).rejects.toThrow("cupo");
  });
});
describe("Permisos y RLS", () => {
  it("deniega ventas a compradores y personal de acceso", async () => {
    const command = {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 1 }],
      method: "cash",
      idempotency_key: randomUUID(),
    };
    await expect(execute(db, customer, command)).rejects.toThrow("permiso");
    await expect(execute(db, access, command)).rejects.toThrow("permiso");
  });
  it("taquilla solo trabaja eventos asignados", async () => {
    await db.query(
      "UPDATE event_staff SET active=false WHERE event_id=$1 AND user_id=$2",
      [e2, box.id],
    );
    await expect(sell(1, e2)).rejects.toThrow("permiso");
  });
  it("email escrito en taquilla no atribuye propiedad de cuenta", async () => {
    const r = await execute(db, box, {
      action: "sell",
      event_id: e1,
      items: [{ ticket_type_id: await type(), quantity: 1 }],
      method: "transfer",
      verified: true,
      reference: "REF",
      buyer_email: "customer@example.test",
      idempotency_key: randomUUID(),
    });
    await expect(ticketDocument(db, customer, r.order_id)).rejects.toThrow(
      "permiso",
    );
    expect((await state(db, customer)).orders).toHaveLength(0);
  });
  it("no filtra QR en estado administrativo", async () => {
    await sell();
    const data = JSON.stringify(await state(db, admin));
    expect(data).not.toContain("credential_");
    expect(data).not.toContain("share_encrypted");
  });
  it("RLS impide leer órdenes ajenas y escribir roles", async () => {
    await sell();
    await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        customer.id,
      ]);
      await tx.query("SET LOCAL ROLE authenticated");
      expect((await tx.query("SELECT id FROM orders")).rows).toHaveLength(0);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
          customer.id,
        ]);
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query("INSERT INTO platform_admins VALUES($1)", [customer.id]);
      }),
    ).rejects.toThrow("permission denied");
  });
  it("RLS permite comprador dueño y bloquea credenciales", async () => {
    const r = await reserve();
    await paid(r.order_id);
    await db.transaction(async (tx) => {
      await tx.query("SELECT set_config('request.jwt.claim.sub',$1,true)", [
        customer.id,
      ]);
      await tx.query("SET LOCAL ROLE authenticated");
      expect((await tx.query("SELECT id FROM orders")).rows).toHaveLength(1);
      expect((await tx.query("SELECT id FROM tickets")).rows).toHaveLength(1);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query("SELECT credential_encrypted FROM tickets");
      }),
    ).rejects.toThrow("permission denied");
  });
  it("RLS oculta eventos borrador al público", async () => {
    await db.query("UPDATE events SET status='draft' WHERE id=$1", [e2]);
    await db.transaction(async (tx) => {
      await tx.query("SET LOCAL ROLE anon");
      expect((await tx.query("SELECT id FROM events")).rows).toHaveLength(1);
    });
  });
});
describe("Validación online y documentos", () => {
  it("QR identifica evento sin selección y conserva idempotencia", async () => {
    const sale = await sell(1, e2);
    const doc = await ticketDocument(db, box, sale.order_id);
    const c = {
      action: "scan_auto",
      credential: doc.tickets[0].credential,
      request_id: randomUUID(),
      device_id: "AUTO",
      gate_label: "Puerta",
    };
    const first = await execute(db, access, c);
    expect(first).toMatchObject({ result: "accepted", event_id: e2 });
    expect(first.event_title).toBeTruthy();
    expect(await execute(db, access, c)).toMatchObject({
      result: "accepted",
      event_id: e2,
    });
    expect(
      await execute(db, access, { ...c, request_id: randomUUID() }),
    ).toMatchObject({ result: "already_used" });
    expect(
      (
        await one(
          db,
          "SELECT count(*)::int AS n FROM check_in_attempts WHERE result='accepted'",
        )
      ).n,
    ).toBe(1);
  });
  it("detección automática no revela evento ni consume boleta sin permiso", async () => {
    const sale = await sell(1, e2);
    const doc = await ticketDocument(db, box, sale.order_id);
    await db.query("DELETE FROM event_staff WHERE user_id=$1 AND event_id=$2", [
      access.id,
      e2,
    ]);
    const c = {
      action: "scan_auto",
      credential: doc.tickets[0].credential,
      request_id: randomUUID(),
      device_id: "AUTO",
      gate_label: "Puerta",
    };
    expect(await execute(db, access, c)).toEqual({ result: "unauthorized" });
    expect(
      (
        await one(db, "SELECT status FROM tickets WHERE id=$1", [
          doc.tickets[0].id,
        ])
      ).status,
    ).toBe("valid");
    expect(
      await execute(db, access, {
        ...c,
        credential: "QR ajeno",
        request_id: randomUUID(),
      }),
    ).toEqual({ result: "unknown_ticket" });
  });
  it("dos lectores producen una sola aceptación", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    const results = await Promise.all([
      scan(doc.tickets[0].credential),
      scan(doc.tickets[0].credential),
    ]);
    expect(results.map((r) => r.result).sort()).toEqual([
      "accepted",
      "already_used",
    ]);
  });
  it("reintento por respuesta perdida conserva aceptación original", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id),
      id = randomUUID();
    expect((await scan(doc.tickets[0].credential, e1, id)).result).toBe(
      "accepted",
    );
    expect((await scan(doc.tickets[0].credential, e1, id)).result).toBe(
      "accepted",
    );
    expect(
      (await one(db, "SELECT count(*)::int AS n FROM check_in_attempts")).n,
    ).toBe(1);
  });
  it("rechaza otro evento y consecutivo como credencial", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    expect((await scan(doc.tickets[0].credential, e2)).result).toBe(
      "wrong_event",
    );
    expect((await scan(doc.tickets[0].visible_number)).result).toBe(
      "unknown_ticket",
    );
  });
  it("rechaza operador no autorizado y ventana cerrada", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    expect(
      (await scan(doc.tickets[0].credential, e1, randomUUID(), customer))
        .result,
    ).toBe("unauthorized");
    await db.query(
      "UPDATE events SET admission_ends_at=now()-interval '1 hour',admission_starts_at=now()-interval '2 hours' WHERE id=$1",
      [e1],
    );
    expect((await scan(doc.tickets[0].credential)).result).toBe(
      "outside_admission_window",
    );
  });
  it("anulación impide ingreso", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "cancel_ticket",
      ticket_id: doc.tickets[0].id,
      reason: "Cancelación autorizada",
    });
    expect((await scan(doc.tickets[0].credential)).result).toBe("cancelled");
  });
  it("sustitución invalida QR anterior, conserva número y serial", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "replace_ticket",
      ticket_id: doc.tickets[0].id,
      reason: "QR comprometido",
    });
    const updated = await ticketDocument(db, box, r.order_id);
    expect(updated.tickets[0].visible_number).toBe(
      doc.tickets[0].visible_number,
    );
    expect((await scan(doc.tickets[0].credential)).result).toBe(
      "unknown_ticket",
    );
    expect((await scan(updated.tickets[0].credential)).result).toBe("accepted");
  });
  it("reimpresión y reenvío no crean entradas nuevas", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, box, {
      action: "print_request",
      ticket_id: doc.tickets[0].id,
    });
    await execute(db, box, {
      action: "print_request",
      ticket_id: doc.tickets[0].id,
    });
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(1);
    expect(
      (
        await one(
          db,
          "SELECT is_reprint FROM print_jobs ORDER BY created_at DESC LIMIT 1",
        )
      ).is_reprint,
    ).toBe(true);
    expect(
      (await ticketDocument(db, box, r.order_id)).tickets[0].credential,
    ).toBe(doc.tickets[0].credential);
  });
  it("documento PDF válido y enlace compartido revocable", async () => {
    const r = await sell(),
      doc = await ticketDocument(db, box, r.order_id);
    expect((await ticketPdf(doc)).subarray(0, 4).toString()).toBe("%PDF");
    expect(
      (await ticketDocument(db, null, r.order_id, doc.share)).tickets,
    ).toHaveLength(1);
    await execute(db, box, { action: "revoke_share", order_id: r.order_id });
    await expect(
      ticketDocument(db, null, r.order_id, doc.share),
    ).rejects.toThrow("sesión");
  });
});
describe("Pagos, entrega y caja", () => {
  it("correo contiene QR y PDF individual por entrada, reintento congela adjuntos", async () => {
    const r = await reserve(2);
    await paid(r.order_id);
    let firstPayload = "";
    await deliver(db, {
      send: async (message) => {
        const pdfs = message.attachments.filter(
          (a) => a.content_type === "application/pdf",
        );
        const images = message.attachments.filter(
          (a) => a.content_type === "image/png",
        );
        expect(pdfs).toHaveLength(2);
        expect(images).toHaveLength(2);
        expect(images[0].content).not.toBe(images[1].content);
        expect(message.html).toContain('src="cid:entrada-0"');
        expect(message.html).not.toContain("pc:");
        for (const file of pdfs)
          expect(
            (
              await PDFDocument.load(Buffer.from(file.content, "base64"))
            ).getPageCount(),
          ).toBe(1);
        firstPayload = JSON.stringify(message.attachments);
        throw new Error("Fallo simulado");
      },
    });
    await db.query(
      "UPDATE events SET title='Título cambiado después del intento' WHERE id=$1",
      [e1],
    );
    await db.query("UPDATE delivery_jobs SET next_attempt_at=now()");
    await deliver(db, {
      send: async (message) => {
        expect(JSON.stringify(message.attachments)).toBe(firstPayload);
      },
    });
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "sent",
    );
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(2);
    expect(JSON.stringify(await state(db, admin))).not.toContain(
      "email_payload_encrypted",
    );
    await expect(
      db.transaction(async (tx) => {
        await tx.query("SET LOCAL ROLE authenticated");
        await tx.query("SELECT email_payload_encrypted FROM delivery_jobs");
      }),
    ).rejects.toThrow(/permission denied/);
  });
  it("fallo de email conserva la venta y se reintenta sin reemitir", async () => {
    const r = await reserve();
    await paid(r.order_id);
    await deliver(db, {
      send: async () => {
        throw new Error("Proveedor desconectado");
      },
    });
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "failed",
    );
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("confirmed");
    await db.query("UPDATE delivery_jobs SET next_attempt_at=now()");
    await deliver(db, { send: async () => {} });
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "sent",
    );
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(1);
  });
  it("registra devolución de pago tardío sin boletas", async () => {
    await db.query("UPDATE events SET capacity=1 WHERE id=$1", [e1]);
    const r = await reserve();
    await db.query(
      "UPDATE orders SET reservation_expires_at=now()-interval '1 second' WHERE id=$1",
      [r.order_id],
    );
    await sell();
    await paid(r.order_id);
    await execute(db, admin, {
      action: "refund",
      order_id: r.order_id,
      ticket_ids: [],
      amount_cop: 45000,
      reason: "Pago tardío sin cupo",
      external_reference: "REF-TEST",
    });
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("refunded");
  });
  it("devolución en efectivo descuenta la caja abierta", async () => {
    await execute(db, box, {
      action: "cash_open",
      event_id: e1,
      opening_cash_cop: 10000,
    });
    const r = await sell(1, e1, "cash"),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "refund",
      order_id: r.order_id,
      ticket_ids: [doc.tickets[0].id],
      amount_cop: 55000,
      reason: "Devolución manual en efectivo",
      external_reference: "EF-TEST",
    });
    const s = await one(db, "SELECT id FROM cash_sessions");
    expect(
      await execute(db, box, {
        action: "cash_close",
        event_id: e1,
        session_id: s.id,
        declared_cash_cop: 10000,
        notes: "",
      }),
    ).toEqual({ expected: 10000, difference: 0 });
  });
  it("rechaza importe alterado y webhook inválido", async () => {
    const r = await reserve();
    await expect(
      db.transaction((tx) =>
        settle(tx, {
          orderId: r.order_id,
          transactionId: "X",
          amount: 1,
          currency: "COP",
          status: "APPROVED",
        }),
      ),
    ).rejects.toThrow("coincide");
    const body = {
      event: "transaction.updated",
      environment: "test",
      data: {
        transaction: {
          id: "T",
          status: "APPROVED",
          amount_in_cents: 4500000,
          reference: "R",
          currency: "COP",
        },
      },
      timestamp: 123,
      signature: {
        properties: [
          "transaction.id",
          "transaction.status",
          "transaction.amount_in_cents",
        ],
        checksum: "0".repeat(64),
      },
    };
    expect(() => verifyWebhook(body, "test-secret")).toThrow("Firma");
    body.signature.checksum = hash("TAPPROVED4500000123test-secret");
    expect(verifyWebhook(body, "test-secret").data.transaction.id).toBe("T");
  });
  it("ignora notificación duplicada y tardía de rechazo tras aprobación", async () => {
    const r = await reserve(2);
    await paid(r.order_id);
    await paid(r.order_id);
    await paid(r.order_id, "DECLINED");
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("confirmed");
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(2);
  });
  it("email con outbox persistente no duplica entradas", async () => {
    const r = await reserve();
    await paid(r.order_id);
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "pending",
    );
    await deliver(db);
    expect((await one(db, "SELECT status FROM delivery_jobs")).status).toBe(
      "sent",
    );
    await execute(db, customer, { action: "resend", order_id: r.order_id });
    await deliver(db);
    expect((await one(db, "SELECT count(*)::int AS n FROM tickets")).n).toBe(1);
  });
  it("cierre calcula solo efectivo y conserva diferencia", async () => {
    await execute(db, box, {
      action: "cash_open",
      event_id: e1,
      opening_cash_cop: 10000,
    });
    await sell(1, e1, "cash");
    await sell(1, e1, "transfer");
    const s = await one(db, "SELECT id FROM cash_sessions");
    await execute(db, box, {
      action: "cash_move",
      event_id: e1,
      session_id: s.id,
      type: "out",
      amount_cop: 5000,
      reason: "Gasto autorizado",
    });
    expect(
      await execute(db, box, {
        action: "cash_close",
        event_id: e1,
        session_id: s.id,
        declared_cash_cop: 59000,
        notes: "Diferencia real",
      }),
    ).toEqual({ expected: 60000, difference: -1000 });
  });
  it("reembolso parcial identifica entradas, respeta importe y anula acceso", async () => {
    const r = await sell(2),
      doc = await ticketDocument(db, box, r.order_id);
    await execute(db, admin, {
      action: "refund",
      order_id: r.order_id,
      ticket_ids: [doc.tickets[0].id],
      amount_cop: 55000,
      reason: "Devolución acordada",
      external_reference: "BANCO-TEST",
    });
    expect(
      (await one(db, "SELECT status FROM orders WHERE id=$1", [r.order_id]))
        .status,
    ).toBe("partially_refunded");
    expect((await scan(doc.tickets[0].credential)).result).toBe("cancelled");
    await expect(
      execute(db, admin, {
        action: "refund",
        order_id: r.order_id,
        ticket_ids: [doc.tickets[1].id],
        amount_cop: 90000,
        reason: "Test",
        external_reference: "X",
      }),
    ).rejects.toThrow("supera");
  });
  it("exportación CSV neutraliza fórmulas y comillas", () => {
    const result = csv([
      { name: '=HYPERLINK("x")', note: "+evil", extra: "@cmd" },
    ]);
    expect(result).toContain('"\'=HYPERLINK(""x"")"');
    expect(result).toContain('"\'+evil"');
    expect(result).toContain('"\'@cmd"');
  });
  it("deshabilita demo en producción", async () => {
    const previous = process.env.NODE_ENV;
    vi.stubEnv("NODE_ENV", "production");
    try {
      const r = await reserve();
      await expect(
        execute(db, customer, { action: "demo_payment", order_id: r.order_id }),
      ).rejects.toThrow("prohibido");
    } finally {
      vi.stubEnv("NODE_ENV", previous);
    }
  });
});
