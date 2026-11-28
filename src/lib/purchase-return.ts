/** Only public event pages may resume a purchase after authentication. */
export function purchaseReturn(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;
  if (
    !/^\/events\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\?selection=[a-f0-9:,%-]+)?$/.test(
      value,
    )
  )
    return null;
  return value;
}
export function purchaseSelection(
  value: string | null,
): Record<string, number> {
  const selected: Record<string, number> = {};
  for (const item of (value ?? "").split(",").slice(0, 20)) {
    const [id, amount] = item.split(":");
    const quantity = Number(amount);
    if (
      /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id) &&
      Number.isInteger(quantity) &&
      quantity > 0 &&
      quantity <= 20
    )
      selected[id] = quantity;
  }
  return selected;
}
