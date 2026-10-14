import type { DB } from "./db";
export const DEMO_ORG = "00000000-0000-4000-8000-000000000001";
export const USERS = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    name: "Administración demo",
    role: "platform_admin",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    name: "Organización demo",
    role: "organizer",
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    name: "Taquilla demo",
    role: "box_office",
  },
  {
    id: "00000000-0000-4000-8000-000000000014",
    name: "Acceso demo",
    role: "access_staff",
  },
  {
    id: "00000000-0000-4000-8000-000000000015",
    name: "Comprador demo",
    role: "customer",
  },
].map((u) => ({ ...u, email: `${u.role}@example.test`, email_verified: true }));
export async function seed(db: DB) {
  await db.transaction(async (tx) => {
    if ((await tx.query("SELECT id FROM organizations LIMIT 1")).rows.length)
      return;
    await tx.query("INSERT INTO organizations(id,name) VALUES($1,$2)", [
      DEMO_ORG,
      "Pase Central · demostración",
    ]);
    for (const u of USERS)
      await tx.query("INSERT INTO profiles(id,name,email) VALUES($1,$2,$3)", [
        u.id,
        u.name,
        `${u.role}@example.test`,
      ]);
    await tx.query("INSERT INTO platform_admins(user_id) VALUES($1)", [
      USERS[0].id,
    ]);
    await tx.query("INSERT INTO organization_members VALUES($1,$2,$3)", [
      DEMO_ORG,
      USERS[1].id,
      "organizer",
    ]);
    for (const [i, title] of [
      "Noche tropical · DEMO",
      "Sesión electrónica · DEMO",
    ].entries()) {
      const id = `00000000-0000-4000-8000-00000000000${i + 2}`;
      await tx.query(
        `INSERT INTO events(id,organization_id,slug,title,description,venue_name,address,starts_at,ends_at,admission_starts_at,admission_ends_at,capacity,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,now(),now()+interval '8 days',now(),now()+interval '8 days',200,'published',$8)`,
        [
          id,
          DEMO_ORG,
          i ? "sesion-electronica-demo" : "noche-tropical-demo",
          title,
          "Evento ficticio para probar ventas y control de acceso. No es una fiesta real.",
          "Recinto de demostración",
          "Dirección ficticia · Colombia",
          USERS[0].id,
        ],
      );
      await tx.query("UPDATE events SET minimum_age=0 WHERE id=$1", [id]);
      for (const u of USERS.slice(2, 4))
        await tx.query("INSERT INTO event_staff VALUES($1,$2,$3,true)", [
          id,
          u.id,
          u.role,
        ]);
      for (const [name, cap, price] of [
        ["General", 150, 45000],
        ["VIP", 50, 90000],
      ] as const) {
        const t = (
          await tx.query(
            "INSERT INTO ticket_types(event_id,name,capacity) VALUES($1,$2,$3) RETURNING id",
            [id, name, cap],
          )
        ).rows[0].id;
        for (const channel of ["web", "box_office"])
          await tx.query(
            `INSERT INTO pricing_phases(ticket_type_id,channel,name,price_cop,starts_at,ends_at) VALUES($1,$2,$3,$4,now()-interval '1 day',now()+interval '8 days')`,
            [
              t,
              channel,
              channel === "web" ? "Preventa demo" : "Taquilla demo",
              price + (channel === "box_office" ? 10000 : 0),
            ],
          );
      }
    }
  });
}
