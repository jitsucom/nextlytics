// --- Types ---

type Expr =
  | { type: "path"; parts: string[] }
  | { type: "call"; func: string; args: Expr[] }
  | { type: "string"; value: string }
  | { type: "number"; value: number };

export type CompiledTemplate = Array<
  { type: "text"; value: string } | { type: "expr"; expr: Expr }
>;
export type TemplateFunction = (...values: unknown[]) => string;
export type TemplateFunctions = Record<string, TemplateFunction>;

// --- Compile ---

export function compile(template: string): CompiledTemplate {
  const result: CompiledTemplate = [];
  let i = 0,
    text = "";

  while (i < template.length) {
    // Escaped \{{ or \}}
    if (
      template[i] === "\\" &&
      "{}".includes(template[i + 1]) &&
      template[i + 1] === template[i + 2]
    ) {
      text += template.slice(i + 1, i + 3);
      i += 3;
    } else if (template.slice(i, i + 2) === "{{") {
      if (text) {
        result.push({ type: "text", value: text });
        text = "";
      }
      const end = template.indexOf("}}", i + 2);
      if (end === -1) throw new Error(`Unclosed {{ at position ${i}`);
      result.push({ type: "expr", expr: parseExpr(template.slice(i + 2, end).trim()) });
      i = end + 2;
    } else {
      text += template[i++];
    }
  }
  if (text) result.push({ type: "text", value: text });
  return result;
}

// --- Apply ---

export function apply(
  tpl: CompiledTemplate,
  params: Record<string, unknown>,
  fns: TemplateFunctions
): string {
  return tpl.map((p) => (p.type === "text" ? p.value : evalExpr(p.expr, params, fns))).join("");
}

// --- Internal ---

function parseExpr(s: string): Expr {
  // String literal
  if ((s[0] === '"' || s[0] === "'") && s[0] === s[s.length - 1]) {
    const esc: Record<string, string> = { n: "\n", t: "\t", r: "\r" };
    return {
      type: "string",
      value: s.slice(1, -1).replace(/\\(.)/g, (_, c: string) => esc[c] ?? c),
    };
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(s)) return { type: "number", value: +s };
  // Function call
  const m = s.match(/^(\w+)\(/);
  if (m && s.endsWith(")"))
    return { type: "call", func: m[1], args: splitArgs(s.slice(m[0].length, -1)).map(parseExpr) };
  // Path
  return { type: "path", parts: s.split(".") };
}

function splitArgs(s: string): string[] {
  const args: string[] = [];
  let cur = "",
    depth = 0,
    quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if ((c === '"' || c === "'") && s[i - 1] !== "\\") quote = quote === c ? null : (quote ?? c);
    if (!quote) {
      if (c === "(") depth++;
      if (c === ")") depth--;
      if (c === "," && depth === 0) {
        args.push(cur.trim());
        cur = "";
        continue;
      }
    }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function resolve(parts: string[], obj: unknown): unknown {
  for (const p of parts) {
    if (obj == null || typeof obj !== "object") return undefined;
    obj = (obj as Record<string, unknown>)[p];
  }
  return obj;
}

function evalExpr(e: Expr, params: Record<string, unknown>, fns: TemplateFunctions): string {
  if (e.type === "string") return e.value;
  if (e.type === "number") return String(e.value);
  if (e.type === "path") return String(resolve(e.parts, params) ?? "");
  const fn = fns[e.func];
  if (!fn) throw new Error(`Unknown function: ${e.func}`);
  return fn(
    ...e.args.map((a) =>
      a.type === "path"
        ? resolve(a.parts, params)
        : a.type === "call"
          ? evalExpr(a, params, fns)
          : a.value
    )
  );
}
