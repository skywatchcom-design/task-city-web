import { assertEquals } from "jsr:@std/assert@1.0.8";
import { extractJson, parseRequest, runAi, validateOutput } from "./core.ts";

Deno.test("parseRequest rejects bad input", () => {
  assertEquals(parseRequest(null), "bad_body");
  assertEquals(parseRequest({ mode: "hack", text: "x" }), "bad_mode");
  assertEquals(parseRequest({ mode: "dump", text: "   " }), "empty_text");
  assertEquals(parseRequest({ mode: "breakdown", text: "x".repeat(301) }), "text_too_long");
});

Deno.test("parseRequest normalizes", () => {
  const r = parseRequest({ mode: "stuck", text: " לעשות  מס ", today: "2026-13-40", postponed: 1e9 });
  if (typeof r === "string") throw new Error(r);
  assertEquals(r.text, "לעשות מס");
  assertEquals(r.today.length, 10);
  assertEquals(r.postponed, 99);
  assertEquals(r.lang, "he");
});

Deno.test("validateOutput keeps only safe fields", () => {
  const out = validateOutput("dump", {
    tasks: [
      { title: "להתקשר לדני", date: "2026-10-29", time: "17:00", priority: "high", evil: "x" },
      { title: "", date: "x" },
      { title: "לקנות חלב", date: "tomorrow", time: "25:00", priority: "urgent!!" },
    ],
    sql: "drop table tasks",
  });
  assertEquals(out, {
    tasks: [
      { title: "להתקשר לדני", date: "2026-10-29", time: "17:00", priority: "high" },
      { title: "לקנות חלב", date: null, time: null, priority: "normal" },
    ],
  });
  assertEquals(validateOutput("breakdown", { steps: [{ title: "a", minutes: 5 }] }), null);
  assertEquals(validateOutput("stuck", { message: "הכול בסדר", first_step: "לפתוח את הקובץ" }), {
    message: "הכול בסדר",
    first_step: "לפתוח את הקובץ",
  });
});

Deno.test("extractJson handles fenced output", () => {
  assertEquals(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assertEquals(extractJson("nope"), null);
});

Deno.test("runAi falls back to the next free provider on 429", async () => {
  const calls: string[] = [];
  const fakeFetch = ((url: string) => {
    calls.push(new URL(url).host);
    if (url.includes("googleapis")) return Promise.resolve(new Response("quota", { status: 429 }));
    return Promise.resolve(Response.json({
      choices: [{ message: { content: '{"steps":[{"title":"א","minutes":5},{"title":"ב","minutes":10}]}' } }],
    }));
  }) as unknown as typeof fetch;
  const env = (k: string) => ({ GEMINI_API_KEY: "g", GROQ_API_KEY: "q" } as Record<string, string>)[k];
  const r = parseRequest({ mode: "breakdown", text: "לעשות מס הכנסה" });
  if (typeof r === "string") throw new Error(r);
  const res = await runAi(r, env, fakeFetch, () => {});
  assertEquals(calls, ["generativelanguage.googleapis.com", "api.groq.com"]);
  assertEquals(res?.provider, "groq");
});

Deno.test("runAi returns null when every provider is out", async () => {
  const fakeFetch = (() => Promise.resolve(new Response("", { status: 429 }))) as unknown as typeof fetch;
  const env = (k: string) => ({ GEMINI_API_KEY: "g" } as Record<string, string>)[k];
  const r = parseRequest({ mode: "dump", text: "x" });
  if (typeof r === "string") throw new Error(r);
  assertEquals(await runAi(r, env, fakeFetch, () => {}), null);
});
