/**
 * Pure reducer for the POS numpad value string.
 * Pass as the updater to setNumpadValue:
 *   setNumpadValue(prev => applyNumpadKey(prev, key))
 */
export function applyNumpadKey(prev: string, key: string): string {
  if (key === "⌫") return prev.slice(0, -1);
  if (key === ".") {
    if (prev.includes(".")) return prev;
    return (prev || "0") + ".";
  }
  // Max 2 decimal places
  const dot = prev.indexOf(".");
  if (dot !== -1 && prev.length - dot > 2) return prev;
  // No leading zeros before decimal
  if (prev === "0") return key;
  return prev + key;
}
