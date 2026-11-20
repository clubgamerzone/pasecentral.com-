// The event's persisted issuance sequence, never the position in a print batch.
export function ticketCounter(sequence: unknown): string | null {
  return typeof sequence === "number" &&
    Number.isSafeInteger(sequence) &&
    sequence > 0
    ? String(sequence).padStart(6, "0")
    : null;
}
