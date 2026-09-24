/** Accurate returns dates as dd/mm/yyyy; never pass those through the US-style Date parser. */
export function formatDocumentDate(value: string, withTime = false): string {
  if (!value) return "—";
  const accurateDate = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const isoDate = accurateDate
    ? `${accurateDate[3]}-${accurateDate[2].padStart(2, "0")}-${accurateDate[1].padStart(2, "0")}`
    : null;
  const date = new Date(isoDate ? `${isoDate}T00:00:00+07:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  if (
    isoDate &&
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(
      date,
    ) !== isoDate
  )
    return value;
  return date.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
