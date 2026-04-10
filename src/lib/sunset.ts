/**
 * Approximate sunset time calculation using the NOAA solar formula.
 * Accurate to within ~3 minutes for UK latitudes.
 */

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((date.getTime() - start.getTime()) / 86400000);
}

function isUKDST(date: Date): boolean {
  // BST: last Sunday in March → last Sunday in October
  function lastSunday(year: number, month: number): Date {
    const d = new Date(year, month + 1, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }
  const bstStart = lastSunday(date.getFullYear(), 2);  // March
  const bstEnd   = lastSunday(date.getFullYear(), 9);  // October
  return date >= bstStart && date < bstEnd;
}

export function getSunsetTime(
  dateStr: string,
  lat = 51.6,   // default: Finchley, London
  lon = -0.19,
): string {
  const date = new Date(dateStr + "T00:00:00");
  const N = getDayOfYear(date);

  // Fractional year (radians)
  const γ = (2 * Math.PI / 365) * (N - 1);

  // Equation of time (minutes)
  const eqtime =
    229.18 * (
      0.000075 +
      0.001868 * Math.cos(γ)     - 0.032077 * Math.sin(γ) -
      0.014615 * Math.cos(2 * γ) - 0.04089  * Math.sin(2 * γ)
    );

  // Solar declination (radians)
  const decl =
    0.006918 -
    0.399912 * Math.cos(γ)     + 0.070257 * Math.sin(γ) -
    0.006758 * Math.cos(2 * γ) + 0.000907 * Math.sin(2 * γ) -
    0.002697 * Math.cos(3 * γ) + 0.001480 * Math.sin(3 * γ);

  const latRad = (lat * Math.PI) / 180;

  // Hour angle at sunset — zenith 90.833° accounts for refraction + sun radius
  const zenith = (90.833 * Math.PI) / 180;
  const cosHA =
    (Math.cos(zenith) - Math.sin(latRad) * Math.sin(decl)) /
    (Math.cos(latRad) * Math.cos(decl));

  if (cosHA > 1 || cosHA < -1) return "";

  const HA = (Math.acos(cosHA) * 180) / Math.PI;

  // Sunset in minutes from UTC midnight
  const sunsetUTC = 720 - 4 * lon - eqtime + 4 * HA;

  const offsetMin = isUKDST(date) ? 60 : 0;
  const sunsetLocal = sunsetUTC + offsetMin;

  const h = Math.floor(sunsetLocal / 60) % 24;
  const m = Math.round(sunsetLocal % 60);
  return `${String(h).padStart(2, "0")}:${String(m >= 60 ? 59 : m).padStart(2, "0")}`;
}

/** How many minutes slot time is before sunset (negative = after sunset) */
export function minutesBeforeSunset(slotTime: string, sunset: string): number {
  const [sh, sm] = slotTime.split(":").map(Number);
  const [eh, em] = sunset.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}
