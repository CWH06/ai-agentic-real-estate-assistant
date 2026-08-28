export interface ParsedMarketQuery {
  city: string | null;
  months: number;
}

const INVALID_CITY_VALUES = new Set([
  "the",
  "last",
  "past",
  "previous",
  "market",
  "housing market",
  "real estate market",
]);

/**
 * Convert a natural-language market question into database filters.
 *
 * Example:
 * "Show me the Irvine market for the last 6 months"
 *
 * Returns:
 * {
 *   city: "Irvine",
 *   months: 6
 * }
 */
export function parseMarketQuery(
  query: string,
): ParsedMarketQuery {
  const text = query.trim();

  if (!text) {
    return {
      city: null,
      months: 12,
    };
  }

  return {
    city: parseCity(text),
    months: parseMonths(text),
  };
}

function parseCity(text: string): string | null {
  /*
   * Handles:
   * - market in Irvine
   * - median price in Pasadena
   * - market statistics for San Diego
   */
  const locationPattern =
    /\b(?:in|around|for)\s+([a-z][a-z\s.'-]*?)(?=$|[?.,]|\s+(?:under|below|less than|max|maximum|up to|with|at least|minimum|over|during|within|from|for|last|past|previous|whether)\b|\s+and\s+(?:are|is|if|whether|tell|show|give)\b)/gi;

  for (const match of text.matchAll(locationPattern)) {
    const candidate = cleanCity(match[1]);

    if (
      candidate &&
      !INVALID_CITY_VALUES.has(candidate.toLowerCase())
    ) {
      return titleCase(candidate);
    }
  }

  /*
   * Handles:
   * - Irvine market
   * - Irvine housing market
   * - How is Irvine's housing market?
   */
  const marketPattern =
    /^(?:show me\s+|tell me about\s+|how is\s+|what is\s+)?([a-z][a-z\s.'-]*?)(?:['’]s)?\s+(?:housing\s+|real estate\s+)?market\b/i;

  const marketMatch = text.match(marketPattern);

  if (marketMatch) {
    const candidate = cleanCity(marketMatch[1]);

    if (
      candidate &&
      !INVALID_CITY_VALUES.has(candidate.toLowerCase())
    ) {
      return titleCase(candidate);
    }
  }

  return null;
}

function parseMonths(text: string): number {
  /*
   * Handles:
   * - last 6 months
   * - past 24 months
   * - over 3 months
   * - 6-month trend
   */
  const monthMatch = text.match(
    /\b(?:last|past|previous|over|during)?\s*(\d+)\s*[- ]?\s*months?\b/i,
  );

  if (monthMatch) {
    return clampMonths(Number(monthMatch[1]));
  }

  /*
   * Handles:
   * - last 2 years
   * - past 3 years
   */
  const yearMatch = text.match(
    /\b(?:last|past|previous|over|during)?\s*(\d+)\s*[- ]?\s*years?\b/i,
  );

  if (yearMatch) {
    return clampMonths(Number(yearMatch[1]) * 12);
  }

  if (/\b(?:last|past|previous)\s+year\b/i.test(text)) {
    return 12;
  }

  return 12;
}

function clampMonths(months: number): number {
  if (!Number.isFinite(months)) {
    return 12;
  }

  return Math.min(60, Math.max(1, Math.floor(months)));
}

function cleanCity(value: string): string {
  return value
    .trim()
    .replace(/[,.?]+$/, "")
    .replace(/\s+/g, " ");
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map(
          (part) =>
            part.charAt(0).toUpperCase() +
            part.slice(1).toLowerCase(),
        )
        .join("-"),
    )
    .join(" ");
}
