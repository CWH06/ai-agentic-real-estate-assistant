import type { PropertyFilters, PropertyType } from "../../types/propertyFilters";

const EMPTY_FILTERS: PropertyFilters = {
  city: null,
  maxPrice: null,
  beds: null,
  baths: null,
  sqft: null,
  type: null,
  pool: null,
  hasView: null,
  maxHoa: null,
};

const TYPE_PATTERNS: Array<[RegExp, PropertyType]> = [
  [/\b(manufactured home|mobile home|mobile homes)\b/i, "ManufacturedHome"],
  [/\b(condo|condos|condominium|condominiums)\b/i, "Condominium"],
  [/\b(townhome|townhomes|townhouse|town house|townhouses)\b/i, "Townhouse"],
  [/\b(single family|single-family|sfh|house|home|homes)\b/i, "SingleFamilyResidence"],
  [/\b(land|lot)\b/i, "UnimprovedLand"],
  [/\bduplex\b/i, "Duplex"],
  [/\btriplex\b/i, "Triplex"],
];

const CITY_STOPS = [
  "under",
  "below",
  "less than",
  "with",
  "at least",
  "minimum",
  "max",
  "maximum",
  "around",
  "near",
  "that",
  "and",
];

export function parsePropertyQuery(query: string): PropertyFilters {
  const text = query.trim();
  if (!text) return { ...EMPTY_FILTERS };

  return {
    city: parseCity(text),
    maxPrice: parsePrice(text),
    beds: parseBeds(text),
    baths: parseBaths(text),
    sqft: parseSqft(text),
    type: parseType(text),
    pool: /\b(pool|swimming pool)\b/i.test(text) ? "True" : null,
    hasView: /\b(view|views|ocean view|mountain view|city view)\b/i.test(text) ? "True" : null,
    maxHoa: parseHoa(text),
  };
}

function parseCity(text: string): string | null {
  const match = text.match(/\b(?:in|around|near)\s+([a-z][a-z\s.-]*?)(?=$|\s+(?:under|below|less than|with|at least|minimum|max|maximum|around|near|that|and)\b)/i);
  if (!match) return null;

  let city = match[1].trim().replace(/[,.]$/, "");
  for (const stop of CITY_STOPS) {
    const stopIndex = city.toLowerCase().indexOf(` ${stop}`);
    if (stopIndex >= 0) city = city.slice(0, stopIndex).trim();
  }

  return city ? titleCase(city) : null;
}

function parsePrice(text: string): number | null {
  const match = text.match(/\b(?:under|below|less than|max(?:imum)?(?: price)?|up to)\s+\$?([\d,.]+)\s*([kKmM])?\b/i);
  if (!match) return null;
  return parseCompactNumber(match[1], match[2]);
}

function parseBeds(text: string): number | null {
  const match = text.match(/\b(\d+)\s*(?:[- ]\s*)?(?:\+\s*)?(?:bed|beds|bedroom|bedrooms|bd)\b/i);
  if (match) return Number(match[1]);

  const atLeast = text.match(/\b(?:at least|minimum|min)\s+(\d+)\s*(?:[- ]\s*)?(?:bed|beds|bedroom|bedrooms|bd)\b/i);
  return atLeast ? Number(atLeast[1]) : null;
}

function parseBaths(text: string): number | null {
  const match = text.match(/\b(\d+(?:\.5)?)\s*(?:\+\s*)?(?:bath|baths|bathroom|bathrooms|ba)\b/i);
  if (match) return Number(match[1]);

  const atLeast = text.match(/\b(?:at least|minimum|min)\s+(\d+(?:\.5)?)\s*(?:bath|baths|bathroom|bathrooms|ba)\b/i);
  return atLeast ? Number(atLeast[1]) : null;
}

function parseSqft(text: string): number | null {
  const match = text.match(/\b(?:at least|minimum|min|over|above)?\s*([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)\b/i);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function parseHoa(text: string): number | null {
  const match = text.match(/\b(?:hoa|association fee)\s*(?:under|below|less than|max(?:imum)?|up to)?\s*\$?([\d,]+)\b/i)
    ?? text.match(/\b(?:under|below|less than|max(?:imum)?|up to)\s*\$?([\d,]+)\s*(?:hoa|association fee)\b/i);
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

function parseType(text: string): PropertyType | null {
  return TYPE_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

function parseCompactNumber(value: string, suffix?: string): number {
  let number = Number(value.replace(/,/g, ""));
  if (suffix?.toLowerCase() === "k") number *= 1_000;
  if (suffix?.toLowerCase() === "m") number *= 1_000_000;
  return Math.round(number);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
