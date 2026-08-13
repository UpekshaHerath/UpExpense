/**
 * A single short buzz on save. Makes entry feel physical on a phone, which is
 * where nearly all of it happens. Silently absent on desktop and on iOS Safari.
 */
export function tapHaptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    // Some browsers throw when vibration is blocked by permissions policy.
  }
}
