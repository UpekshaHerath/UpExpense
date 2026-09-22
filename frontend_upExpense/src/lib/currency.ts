/** The currency every account starts on (profiles.currency default). */
export const DEFAULT_CURRENCY = "USD";

/**
 * Circulating ISO 4217 codes. Intl.supportedValuesOf("currency") would also
 * hand back withdrawn ones (ADP, ZWD…), which nobody should be offered.
 */
export const CURRENCY_CODES = [
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
  "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD",
  "GNF", "GTQ", "GYD", "HKD", "HNL", "HTG", "HUF", "IDR", "ILS", "INR",
  "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR", "KMF",
  "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD", "LSL",
  "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU", "MUR",
  "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK", "NPR",
  "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG", "QAR",
  "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK", "SGD",
  "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SYP", "SZL", "THB", "TJS",
  "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH", "UGX", "USD",
  "UYU", "UZS", "VES", "VND", "VUV", "WST", "XAF", "XCD", "XOF", "XPF",
  "YER", "ZAR", "ZMW", "ZWG",
] as const;

export function isCurrencyCode(code: unknown): code is string {
  return (
    typeof code === "string" &&
    (CURRENCY_CODES as readonly string[]).includes(code)
  );
}

export type CurrencyInfo = { code: string; name: string; symbol: string };

let displayNames: Intl.DisplayNames | null = null;

export function currencyName(code: string): string {
  try {
    displayNames ??= new Intl.DisplayNames(["en"], { type: "currency" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The short mark shown in front of amounts: "Rs", "$", "€", "KWD". */
export function currencySymbol(code: string): string {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? code
    );
  } catch {
    return code;
  }
}

export function currencyInfo(code: string): CurrencyInfo {
  return { code, name: currencyName(code), symbol: currencySymbol(code) };
}

let allCurrencies: CurrencyInfo[] | null = null;

/** Every offered currency, sorted by name. Built once, on first use. */
export function listCurrencies(): CurrencyInfo[] {
  allCurrencies ??= CURRENCY_CODES.map(currencyInfo).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  return allCurrencies;
}

/** Country → currency for the regions a browser locale most often names. */
const REGION_CURRENCY: Record<string, string> = {
  AE: "AED", AR: "ARS", AU: "AUD", BD: "BDT", BH: "BHD", BR: "BRL",
  CA: "CAD", CH: "CHF", CL: "CLP", CN: "CNY", CO: "COP", CZ: "CZK",
  DK: "DKK", EG: "EGP", GB: "GBP", GH: "GHS", HK: "HKD", HU: "HUF",
  ID: "IDR", IL: "ILS", IN: "INR", JP: "JPY", KE: "KES", KR: "KRW",
  KW: "KWD", LK: "LKR", MV: "MVR", MX: "MXN", MY: "MYR", NG: "NGN",
  NO: "NOK", NP: "NPR", NZ: "NZD", OM: "OMR", PH: "PHP", PK: "PKR",
  PL: "PLN", QA: "QAR", RO: "RON", RU: "RUB", SA: "SAR", SE: "SEK",
  SG: "SGD", TH: "THB", TR: "TRY", TW: "TWD", UA: "UAH", US: "USD",
  VN: "VND", ZA: "ZAR",
  // Eurozone
  AT: "EUR", BE: "EUR", CY: "EUR", DE: "EUR", EE: "EUR", ES: "EUR",
  FI: "EUR", FR: "EUR", GR: "EUR", HR: "EUR", IE: "EUR", IT: "EUR",
  LT: "EUR", LU: "EUR", LV: "EUR", MT: "EUR", NL: "EUR", PT: "EUR",
  SI: "EUR", SK: "EUR",
};

/** A starting suggestion for the picker, from the browser's locale. */
export function guessCurrency(): string {
  try {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const region = new Intl.Locale(tag).maximize().region;
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
  } catch {
    // Old browser without Intl.Locale — fall through.
  }
  return DEFAULT_CURRENCY;
}
