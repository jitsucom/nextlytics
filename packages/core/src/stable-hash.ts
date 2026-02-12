const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function stableStringify(value: unknown, seen: WeakSet<object>): string | undefined {
  if (value === null) return "null";

  const valueType = typeof value;
  if (valueType === "string") return JSON.stringify(value);
  if (valueType === "number") return Number.isFinite(value) ? String(value) : "null";
  if (valueType === "boolean") return value ? "true" : "false";
  if (valueType === "bigint") {
    throw new TypeError("Do not know how to serialize a BigInt");
  }
  if (valueType === "undefined" || valueType === "function" || valueType === "symbol") {
    return undefined;
  }

  if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return stableStringify((value as { toJSON: () => unknown }).toJSON(), seen);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => stableStringify(item, seen) ?? "null");
    return `[${items.join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  if (seen.has(obj)) {
    throw new TypeError("Converting circular structure to JSON");
  }

  seen.add(obj);
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const next = stableStringify(obj[key], seen);
    if (next !== undefined) {
      parts.push(`${JSON.stringify(key)}:${next}`);
    }
  }
  seen.delete(obj);

  return `{${parts.join(",")}}`;
}

function fnv1aHash(input: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash.toString(16).padStart(8, "0");
}

export function stableHash(value: JsonValue): string {
  const stable = stableStringify(value, new WeakSet()) ?? "null";
  return fnv1aHash(stable);
}
