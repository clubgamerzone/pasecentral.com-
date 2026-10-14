export const genders = {
  female: "Mujer / femenino",
  male: "Hombre / masculino",
  other: "Otro",
  prefer_not_to_say: "Prefiero no responder",
} as const;
export const ageBands = {
  "0_5": "0–5 años",
  "6_12": "6–12 años",
  "13_17": "13–17 años",
  "18_24": "18–24 años",
  "25_34": "25–34 años",
  "35_44": "35–44 años",
  "45_54": "45–54 años",
  "55_64": "55–64 años",
  "65_plus": "65 años o más",
} as const;
export type Attendee = {
  gender: keyof typeof genders | null;
  age_band: keyof typeof ageBands | null;
};
