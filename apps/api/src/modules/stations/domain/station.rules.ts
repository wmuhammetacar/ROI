export function normalizeStationName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function normalizeStationCode(code: string): string {
  return code.trim().toUpperCase();
}
