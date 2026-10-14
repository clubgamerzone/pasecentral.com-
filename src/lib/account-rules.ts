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
export function ageRangeCanMeetMinimum(range: string | null, minimum: number) {
  const upper: Record<string, number> = {
    "0_5": 5,
    "6_12": 12,
    "13_17": 17,
    "18_24": 24,
    "25_34": 34,
    "35_44": 44,
    "45_54": 54,
    "55_64": 64,
    "65_plus": Infinity,
  };
  return !range || upper[range] >= minimum;
}
export const registration = z.object({
  name: z.string().trim().min(1).max(150),
  gender,
  age_band: ageBand.nullable().default(null),
  terms_accepted: z.literal(true),
});
