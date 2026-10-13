import { z } from "zod";
const id = z.string().uuid();
const money = z.coerce.number().int().min(0).max(100000000);
const text = z.string().trim().min(1).max(300);
const date = z.string().datetime({ offset: true });
const items = z
  .array(
    z.object({
      ticket_type_id: id,
      quantity: z.coerce.number().int().min(1).max(20),
    }),
  )
  .min(1)
  .max(10);
export const commands = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_event"),
    organization_id: id,
    title: text,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    description: z.string().max(5000),
    venue_name: text,
    address: text,
    starts_at: date,
    ends_at: date,
    admission_starts_at: date,
    admission_ends_at: date,
    capacity: z.coerce.number().int().min(1).max(1000000),
  }),
  z.object({
    action: z.literal("event_status"),
    event_id: id,
    status: z.enum([
      "draft",
      "published",
      "sales_closed",
      "finished",
      "cancelled",
    ]),
  }),
  z.object({
    action: z.literal("add_type"),
    event_id: id,
    name: text,
    capacity: z.coerce.number().int().positive().max(1000000),
  }),
  z.object({
    action: z.literal("add_phase"),
    event_id: id,
    ticket_type_id: id,
    name: text,
    channel: z.enum(["web", "box_office"]),
    price_cop: money,
    starts_at: date,
    ends_at: date,
  }),
  z.object({
    action: z.literal("phase_active"),
    event_id: id,
    phase_id: id,
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("staff"),
    event_id: id,
    user_id: id,
    role: z.enum(["box_office", "access_staff"]),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("member"),
    organization_id: id,
    user_id: id,
    active: z.boolean(),
  }),
  z.object({
    action: z.literal("reserve"),
    event_id: id,
    items,
    buyer_name: text,
    buyer_email: z.email().max(254),
    buyer_phone: z.string().max(30).optional(),
    buyer_category: z.string().max(100).optional(),
    idempotency_key: id,
  }),
  z.object({
    action: z.literal("sell"),
    event_id: id,
    items,
    buyer_name: z.string().max(300).optional(),
    buyer_email: z.union([z.email().max(254), z.literal("")]).optional(),
    buyer_phone: z.string().max(30).optional(),
    buyer_category: z.string().max(100).optional(),
    method: z.enum(["cash", "transfer", "complimentary"]),
    reference: z.string().max(300).optional(),
    verified: z.boolean().optional(),
    reason: z.string().max(500).optional(),
    idempotency_key: id,
  }),
  z.object({ action: z.literal("demo_payment"), order_id: id }),
  z.object({ action: z.literal("checkout"), order_id: id }),
  z.object({
    action: z.literal("reconcile"),
    order_id: id,
    transaction_id: text,
  }),
  z.object({
    action: z.literal("scan_auto"),
    credential: z.string().trim().min(1).max(1000),
    request_id: id,
    device_id: text,
    gate_label: text,
  }),
  z.object({
    action: z.literal("checkin"),
    event_id: id,
    credential: z.string().min(1).max(1000),
    request_id: id,
    device_id: text,
    gate_label: text,
  }),
  z.object({
    action: z.literal("manual_checkin"),
    event_id: id,
    ticket_id: id,
    request_id: id,
    device_id: text,
    gate_label: text,
    reason: z.string().min(5).max(500),
  }),
  z.object({
    action: z.literal("cash_open"),
    event_id: id,
    opening_cash_cop: money,
  }),
  z.object({
    action: z.literal("cash_move"),
    event_id: id,
    session_id: id,
    type: z.enum(["in", "out"]),
    amount_cop: money,
    reason: text,
  }),
  z.object({
    action: z.literal("cash_close"),
    event_id: id,
    session_id: id,
    declared_cash_cop: money,
    notes: z.string().max(500),
  }),
  z.object({
    action: z.literal("cancel_ticket"),
    ticket_id: id,
    reason: z.string().min(5).max(500),
  }),
  z.object({
    action: z.literal("replace_ticket"),
    ticket_id: id,
    reason: z.string().min(5).max(500),
  }),
  z.object({
    action: z.literal("refund"),
    order_id: id,
    ticket_ids: z.array(id).max(100),
    amount_cop: money,
    reason: text,
    external_reference: text,
  }),
  z.object({ action: z.literal("resend"), order_id: id }),
  z.object({ action: z.literal("revoke_share"), order_id: id }),
  z.object({ action: z.literal("print_request"), ticket_id: id }),
  z.object({
    action: z.literal("print_result"),
    job_id: id,
    status: z.enum(["submitted", "confirmed", "failed"]),
  }),
]);
export type Command = z.infer<typeof commands>;
