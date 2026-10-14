export function csv(
  rows: Record<string, unknown>[],
  columns?: Record<string, string>,
) {
  const keys = columns ? Object.keys(columns) : Object.keys(rows[0] ?? {});
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
      keys.map((k) => quote(columns?.[k] ?? k)).join(","),
      ...rows.map((r) => keys.map((k) => quote(r[k])).join(",")),
    ].join("\r\n")
  );
}
