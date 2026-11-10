const LIST_KEYS = ['data', 'items', 'properties', 'results', 'rows', 'listings', 'locations'];

export function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  for (const key of LIST_KEYS) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  for (const key of LIST_KEYS) {
    if (payload[key] && typeof payload[key] === 'object') {
      const nested = toArray(payload[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}
