import type { PropertyFilters } from "../../types/propertyFilters";
import type { PropertyCard } from "./formatListings";

export interface UserSession {
  conversationStep: number;
  filters: PropertyFilters;
  lastResults: PropertyCard[];
}

const emptyFilters: PropertyFilters = {
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

const sessions = new Map<string, UserSession>();

export function getSession(sessionId: string): UserSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      conversationStep: 0,
      filters: { ...emptyFilters },
      lastResults: [],
    });
  }

  return sessions.get(sessionId)!;
}

export function updateSession(sessionId: string, updates: Partial<UserSession>): UserSession {
  const session = getSession(sessionId);
  Object.assign(session, updates);
  sessions.set(sessionId, session);
  return session;
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}
