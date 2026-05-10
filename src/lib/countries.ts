// Shared ISO-2 country code → display name lookup. Used by every page that
// renders vendor / shipping country labels. Kept in one place so adding a new
// vendor country only touches a single file.

export const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  US: 'United States',
  PK: 'Pakistan',
  IN: 'India',
  LV: 'Latvia',
  PL: 'Poland',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
}

export function countryLabel(code: string): string {
  return COUNTRY_NAMES[code] || code
}
