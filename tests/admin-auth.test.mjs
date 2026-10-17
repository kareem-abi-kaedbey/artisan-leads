import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Exercise server modules with fake Auth/DB clients; never use live credentials.
function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const resolve = (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  new Function("require", "exports", code)(resolve, exports);
  return exports;
}

const id = "12345678-1234-1234-1234-123456789abc";

for (const [access, expected] of [["unauthenticated", 401], ["forbidden", 403]]) {
  test(`PATCH denies ${access} before reading input or opening the privileged client`, async () => {
    const { PATCH } = load("src/app/api/leads/[id]/route.ts", {
      "@/lib/supabase-auth/admin": { getAdminAccess: async () => access },
      "@/lib/supabase-server": { getSupabaseServer: () => assert.fail("DB accessed without authorization") },
    });
    const response = await PATCH({ json: () => assert.fail("Body read before authorization") }, { params: Promise.resolve({ id }) });
    assert.equal(response.status, expected);
  });
}

test("admin PATCH retains status-only update and response", async () => {
  const chain = {
    from(table) { assert.equal(table, "leads"); return this; },
    update(data) { assert.deepEqual(data, { status: "contacted" }); return this; },
    eq(column, value) { assert.equal(column, "id"); assert.equal(value, id); return this; },
    select(columns) { assert.equal(columns, "id, status"); return this; },
    async maybeSingle() { return { data: { id, status: "contacted" }, error: null }; },
  };
  const { PATCH } = load("src/app/api/leads/[id]/route.ts", {
    "@/lib/supabase-auth/admin": { getAdminAccess: async () => "admin" },
    "@/lib/supabase-server": { getSupabaseServer: () => chain },
  });
  const response = await PATCH(new Request("http://localhost/api/leads/" + id, {
    method: "PATCH", body: JSON.stringify({ status: "contacted", name: "ignored" }),
  }), { params: Promise.resolve({ id }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, id, status: "contacted" });
});

test("server authorization verifies Auth user id and fails closed without configured admin", async () => {
  const previous = process.env.ADMIN_USER_ID;
  let user = { id: "admin-test" }, error = null;
  const { getAdminAccess, requireAdmin } = load("src/lib/supabase-auth/admin.ts", {
    "server-only": {},
    react: { cache: (fn) => fn },
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "./server": { createAuthServerClient: async () => ({ auth: {
      getUser: async () => ({ data: { user }, error }),
      getSession: () => assert.fail("Unverified session used"),
    } }) },
  });
  try {
    process.env.ADMIN_USER_ID = "admin-test";
    assert.equal(await getAdminAccess(), "admin");
    user = { id: "another-user" };
    assert.equal(await getAdminAccess(), "forbidden");
    await assert.rejects(requireAdmin, /redirect:\/login\?error=forbidden/);
    user = { id: "admin-test" };
    delete process.env.ADMIN_USER_ID;
    assert.equal(await getAdminAccess(), "forbidden");
    error = new Error("Revoked session");
    assert.equal(await getAdminAccess(), "unauthenticated");
    await assert.rejects(requireAdmin, /redirect:\/login$/);
    error = null;
    user = null;
    assert.equal(await getAdminAccess(), "unauthenticated");
  } finally {
    if (previous === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = previous;
  }
});

test("proxy propagates refreshed cookies to the request and browser response", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test";
  const requestCookies = new Map();
  const request = { cookies: { getAll: () => [], set: (name, value) => requestCookies.set(name, value) } };
  const { proxy } = load("src/proxy.ts", {
    "@supabase/ssr": { createServerClient: (url, key, { cookies }) => {
      assert.equal(key, "publishable-test");
      assert.equal(url, "https://example.supabase.co");
      return { auth: { getClaims: async () => {
        cookies.setAll([{ name: "session", value: "refreshed", options: { path: "/" } }], { "Cache-Control": "private, no-store" });
      } } };
    } },
    "next/server": { NextResponse: { next: ({ request: req }) => {
      assert.equal(req, request);
      return { cookies: new Map(), headers: new Headers() };
    } } },
  });
  try {
    const response = await proxy(request);
    assert.equal(requestCookies.get("session"), "refreshed");
    assert.equal(response.cookies.get("session"), "refreshed");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  } finally {
    for (const [key, value] of [["NEXT_PUBLIC_SUPABASE_URL", previousUrl], ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", previousKey]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("login verifies admin identity; non-admin credentials are rejected and signed out", async () => {
  const previous = process.env.ADMIN_USER_ID;
  process.env.ADMIN_USER_ID = "admin-test";
  let userId = "other-user", invalidPassword = false, signedOut = 0;
  const { login, logout } = load("src/app/login/actions.ts", {
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase-auth/server": { createAuthServerClient: async () => ({ auth: {
      signInWithPassword: async () => ({ error: invalidPassword ? new Error("Private provider detail") : null }),
      getUser: async () => ({ data: { user: { id: userId } }, error: null }),
      signOut: async () => { signedOut++; return { error: null }; },
    } }) },
  });
  const form = new FormData();
  form.set("email", "admin@example.test");
  form.set("password", "test-password");
  try {
    const nonAdmin = await login({ error: "" }, form);
    assert.ok(nonAdmin.error);
    assert.equal(signedOut, 1);
    invalidPassword = true;
    assert.deepEqual(await login({ error: "" }, form), nonAdmin);
    invalidPassword = false;
    userId = "admin-test";
    await assert.rejects(() => login({ error: "" }, form), /redirect:\/dashboard$/);
    await assert.rejects(logout, /redirect:\/login$/);
    assert.equal(signedOut, 2);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = previous;
  }
});
