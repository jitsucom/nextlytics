import { describe, it, expect } from "vitest";
import { compile, apply, type TemplateFunctions } from "./template";

const fns: TemplateFunctions = {
  q: (v) => JSON.stringify(v ?? null),
};

describe("template", () => {
  it("text and expressions", () => {
    expect(apply(compile("hello"), {}, fns)).toBe("hello");
    expect(apply(compile("{{x}}"), { x: "world" }, fns)).toBe("world");
    expect(apply(compile("a {{x}} b"), { x: "X" }, fns)).toBe("a X b");
    expect(apply(compile("\\{{x\\}}"), {}, fns)).toBe("{{x}}");
    expect(() => compile("{{x")).toThrow("Unclosed");
  });

  it("paths", () => {
    expect(apply(compile("{{a.b}}"), { a: { b: "v" } }, fns)).toBe("v");
    expect(apply(compile("{{a.b.c}}"), { a: { b: { c: "d" } } }, fns)).toBe("d");
    expect(apply(compile("{{x}}"), {}, fns)).toBe("");
    expect(apply(compile("{{a.b}}"), { a: null }, fns)).toBe("");
  });

  it("literals", () => {
    expect(apply(compile('{{"hi"}}'), {}, fns)).toBe("hi");
    expect(apply(compile("{{'hi'}}"), {}, fns)).toBe("hi");
    expect(apply(compile("{{42}}"), {}, fns)).toBe("42");
    expect(apply(compile("{{-3.14}}"), {}, fns)).toBe("-3.14");
    expect(apply(compile('{{"a\\nb"}}'), {}, fns)).toBe("a\nb");
  });

  it("functions", () => {
    expect(apply(compile("{{q(x)}}"), { x: "a" }, fns)).toBe('"a"');
    expect(apply(compile("{{q(x)}}"), { x: { a: 1 } }, fns)).toBe('{"a":1}');
    expect(apply(compile("{{q(x)}}"), {}, fns)).toBe("null");
    expect(() => apply(compile("{{bad(x)}}"), {}, fns)).toThrow("Unknown function");
  });

  it("multi-arg functions", () => {
    const myFns: TemplateFunctions = {
      cat: (a, b) => `${a}${b}`,
      join: (a, s, b) => `${a}${s}${b}`,
      wrap: (v) => `[${v}]`,
      q: (v) => JSON.stringify(v),
    };
    expect(apply(compile("{{cat(a, b)}}"), { a: "x", b: "y" }, myFns)).toBe("xy");
    expect(apply(compile('{{join(a, "-", b)}}'), { a: "x", b: "y" }, myFns)).toBe("x-y");
    expect(apply(compile('{{cat("a,b", x)}}'), { x: "c" }, myFns)).toBe("a,bc");
    expect(apply(compile("{{wrap(q(x))}}"), { x: "v" }, myFns)).toBe('["v"]');
  });

  it("real-world: GA", () => {
    const src = compile("https://gtm.com/gtag/js?id={{id}}");
    const body = compile("gtag('config', {{q(id)}}); gtag('set', {{q(u.t)}});");
    const p = { id: "GA-1", u: { t: { email: "a@b" } } };
    expect(apply(src, p, fns)).toBe("https://gtm.com/gtag/js?id=GA-1");
    expect(apply(body, p, fns)).toBe(`gtag('config', "GA-1"); gtag('set', {"email":"a@b"});`);
  });
});
