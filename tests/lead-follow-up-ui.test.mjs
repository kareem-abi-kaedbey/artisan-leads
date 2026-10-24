import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  new Function("require", "exports", code)((name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}
const schemas = load("src/lib/ai/follow-up-schema.ts", { zod: require("zod") });
const proposal = { summary: "Projet à préciser.", reasoning: "Les dimensions manquent.", recommendedAction: "Contacter le prospect.", suggestedReply: "Bonjour, pouvez-vous préciser les dimensions ?", proposedStatus: "contacted" };

// Small hook harness follows the repository's injected-module tests. Exercise the
// actual component's rendered event handlers; no DOM/browser package is required.
function harness() {
  let cursor = 0, refreshes = 0;
  const slots = [];
  const state = (initial) => {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
  };
  const { default: Panel } = load("src/components/LeadFollowUpPanel.tsx", {
    react: { useState: state, useRef: (initial) => state({ current: initial })[0], useTransition: () => [false, (fn) => fn()] },
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/navigation": { useRouter: () => ({ refresh: () => refreshes++ }) },
    "@/lib/ai/follow-up-schema": schemas,
  });
  return {
    render(status = "new") { cursor = 0; return Panel({ leadId: "lead-test", status }); },
    refreshes: () => refreshes,
  };
}
function nodes(element) {
  if (!element || typeof element !== "object") return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)];
}
function text(element) {
  if (typeof element === "string" || typeof element === "number") return String(element);
  if (!element || typeof element !== "object") return "";
  return [element.props?.children].flat(Infinity).map(text).join("");
}
function button(tree, label) { return nodes(tree).find((node) => node.type === "button" && text(node) === label); }
const success = (followUp = proposal) => Response.json({ success: true, followUp });

async function withFetch(handler, run) {
  const previous = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return handler(url, options); };
  try { await run(requests); } finally { globalThis.fetch = previous; }
}

test("preparing displays an unapplied AI proposal and never PATCHes", async () => {
  await withFetch(() => success(), async (requests) => {
    const ui = harness();
    await button(ui.render(), "Préparer le suivi").props.onClick();
    const tree = ui.render();
    assert.deepEqual(requests, [{ url: "/api/leads/lead-test/follow-up", method: "POST" }]);
    const html = require("react-dom/server").renderToStaticMarkup(tree);
    for (const value of [proposal.summary, proposal.reasoning, proposal.recommendedAction, proposal.suggestedReply]) assert.ok(text(tree).includes(value));
    assert.match(html, /Proposition de suivi IA/);
    assert.ok(text(tree).includes("Cette proposition n’est pas une action appliquée"));
    assert.ok(text(tree).includes("Statut proposé par l’IA"));
    assert.ok(text(tree).includes("Contacté"));
    assert.ok(button(tree, "Approuver"));
    assert.ok(button(tree, "Refuser"));
    assert.equal(ui.refreshes(), 0);
  });
});

test("only explicit approval PATCHes the existing deterministic status API and refreshes", async () => {
  await withFetch((_url, options) => options.method === "POST" ? success() : Response.json({ success: true, id: "lead-test", status: "contacted" }), async (requests) => {
    const ui = harness();
    await button(ui.render(), "Préparer le suivi").props.onClick();
    assert.equal(requests.length, 1);
    await button(ui.render(), "Approuver").props.onClick();
    assert.deepEqual(requests[1], { url: "/api/leads/lead-test", method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "contacted" }) });
    assert.equal(ui.refreshes(), 1);
    const tree = ui.render("contacted");
    assert.ok(text(tree).includes("Proposition approuvée"));
    assert.equal(button(tree, "Approuver"), undefined);
  });
});

test("rejection is local and cannot mutate or refresh", async () => {
  await withFetch(() => success(), async (requests) => {
    const ui = harness();
    await button(ui.render(), "Préparer le suivi").props.onClick();
    button(ui.render(), "Refuser").props.onClick();
    assert.equal(requests.length, 1);
    assert.equal(ui.refreshes(), 0);
    assert.ok(text(ui.render()).includes("Proposition refusée"));
    assert.equal(button(ui.render(), "Approuver"), undefined);
  });
});

for (const status of [null, "new", "invalid"]) {
  test(`proposedStatus ${status} does not expose an approval/update action`, async () => {
    await withFetch(() => success({ ...proposal, proposedStatus: status }), async (requests) => {
      const ui = harness();
      await button(ui.render(), "Préparer le suivi").props.onClick();
      assert.equal(button(ui.render(), "Approuver"), undefined);
      assert.equal(button(ui.render(), "Refuser"), undefined);
      assert.equal(requests.length, 1);
      assert.equal(ui.refreshes(), 0);
      if (status === "invalid") assert.ok(text(ui.render()).includes("proposition reçue est invalide"));
    });
  });
}

test("a manual status change invalidates approval of the older proposal", async () => {
  await withFetch(() => success(), async (requests) => {
    const ui = harness();
    await button(ui.render(), "Préparer le suivi").props.onClick();
    const tree = ui.render("quote_sent");
    assert.equal(button(tree, "Approuver"), undefined);
    assert.ok(text(tree).includes("Le statut a changé"));
    assert.equal(requests.length, 1);
  });
});

test("generation loading prevents duplicate requests", async () => {
  let finish;
  await withFetch(() => new Promise((resolve) => { finish = resolve; }), async (requests) => {
    const ui = harness();
    const prepare = button(ui.render(), "Préparer le suivi").props.onClick;
    const pending = prepare();
    assert.equal(button(ui.render(), "Préparation du suivi...").props.disabled, true);
    await prepare();
    assert.equal(requests.length, 1);
    finish(success());
    await pending;
    assert.ok(button(ui.render(), "Approuver"));
  });
});

test("approval loading prevents duplicate PATCHes", async () => {
  let finish;
  await withFetch((_url, options) => options.method === "POST" ? success() : new Promise((resolve) => { finish = resolve; }), async (requests) => {
    const ui = harness();
    await button(ui.render(), "Préparer le suivi").props.onClick();
    const approve = button(ui.render(), "Approuver").props.onClick;
    const pending = approve();
    assert.equal(button(ui.render(), "Enregistrement...").props.disabled, true);
    assert.equal(button(ui.render(), "Refuser").props.disabled, true);
    await approve();
    assert.equal(requests.length, 2);
    finish(Response.json({ success: true }));
    await pending;
    assert.equal(ui.refreshes(), 1);
  });
});

test("generation and status errors stay visible without automatic retries", async () => {
  await withFetch(() => Response.json({ message: "Suivi indisponible." }, { status: 502 }), async (requests) => {
    const ui = harness();
    await button(ui.render(), "Préparer le suivi").props.onClick();
    assert.ok(text(ui.render()).includes("Suivi indisponible."));
    assert.equal(button(ui.render(), "Approuver"), undefined);
    assert.equal(requests.length, 1);
  });
  await withFetch((_url, options) => options.method === "POST" ? success() : Response.json({ message: "Modification refusée." }, { status: 403 }), async (requests) => {
    const ui = harness();
    await button(ui.render(), "Préparer le suivi").props.onClick();
    await button(ui.render(), "Approuver").props.onClick();
    assert.ok(text(ui.render()).includes("Modification refusée."));
    assert.equal(ui.refreshes(), 0);
    assert.equal(requests.length, 2);
  });
});
