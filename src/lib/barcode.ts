/** Deterministic pseudo-barcode widths for a serial number. */
export function barcodesFrom(serial: string): number[] {
  const bars: number[] = []
  for (let i = 0; i < 44; i++) {
    const c = serial.charCodeAt(i % serial.length)
    bars.push(((c ^ (i * 17)) % 3) + 1)
  }
  return bars
}
