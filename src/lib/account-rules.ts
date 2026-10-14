import { z } from "zod";
export const gender = z.enum(["female", "male", "other", "prefer_not_to_say"]);
export const ageBand = z.enum([
  "0_5",
  "6_12",
  "13_17",
  "18_24",
  "25_34",
  "35_44",
  "45_54",
  "55_64",
  "65_plus",
]);
export const TERMS_VERSION = "2026-10-14";
export const registration = z.object({
  name: z.string().trim().min(1).max(150),
  gender,
  age_band: ageBand.nullable().default(null),
  terms_accepted: z.literal(true),
});
