import { parsePropertyQuery } from "./parsePropertyQuery";

export async function propertySearchSkill(query: string) {
  return {
    filters: parsePropertyQuery(query),
  };
}

export { parsePropertyQuery };
