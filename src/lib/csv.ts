export function csv(rows: Record<string, unknown>[]) {
  const keys = Object.keys(rows[0] ?? {});
  const quote = (value: unknown) => {
    let v =
      value == null
        ? ""
        : value instanceof Date
          ? value.toISOString()
          : String(value);
    if (/^[\s]*[=+\-@\t\r\n]/.test(v)) v = `'${v}`;
    return `"${v.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      keys.map(quote).join(","),
      ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
    ].join("\r\n")
  );
}
