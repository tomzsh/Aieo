/**
 * Helpers for scheduled / auto-publish times.
 */

/** datetime-local value → WP REST `date` (site local, no timezone suffix) */
export function toWordPressDate(localDateTime: string): string {
  const s = localDateTime.trim();
  if (!s) throw new Error("Waktu jadwal wajib diisi");
  // "YYYY-MM-DDTHH:mm" or with seconds
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 19);
  throw new Error("Format waktu tidak valid (pakai datetime-local)");
}

/** Parse datetime-local as local wall time → ISO UTC for DB storage */
export function localDateTimeToIso(localDateTime: string): string {
  const wp = toWordPressDate(localDateTime);
  // Treat as local browser/server wall clock
  const d = new Date(wp);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Waktu jadwal tidak valid");
  }
  return d.toISOString();
}

export function assertScheduleInFuture(localDateTime: string, minMinutes = 2): Date {
  const iso = localDateTimeToIso(localDateTime);
  const when = new Date(iso);
  const min = Date.now() + minMinutes * 60_000;
  if (when.getTime() < min) {
    throw new Error(
      `Jadwal harus minimal ${minMinutes} menit dari sekarang`
    );
  }
  return when;
}

/** Default schedule: +1 hour, for datetime-local input */
export function defaultScheduleLocal(hoursAhead = 1): string {
  const d = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
