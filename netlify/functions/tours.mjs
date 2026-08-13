import { getStore } from "@netlify/blobs";
import { timingSafeEqual } from "node:crypto";

const STORE_NAME = "arrival-desk-config";
const CONFIG_KEY = "tour-config-v1";
const MAX_BYTES = 900_000;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function configuredPasswords() {
  return [process.env.SHIFT_ADMIN_PASSWORD, process.env.ARRIVAL_DESK_ADMIN_PASSWORD]
    .map(value => String(value || "").trim())
    .filter(Boolean);
}

function authorized(req) {
  const supplied = String(
    req.headers.get("x-arrival-admin") || req.headers.get("x-admin-password") || ""
  ).trim();
  if (!supplied) return false;
  const b = Buffer.from(supplied);
  return configuredPasswords().some(expected => {
    const a = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

function validateConfig(config) {
  if (!Array.isArray(config)) return "Config must be an array.";
  if (config.length > 60) return "Too many tours.";
  const keys = new Set();
  for (const tour of config) {
    if (!tour || typeof tour !== "object") return "Every tour must be an object.";
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(String(tour.key || ""))) return `Invalid tour key: ${tour.key || "(blank)"}`;
    if (keys.has(tour.key)) return `Duplicate tour key: ${tour.key}`;
    keys.add(tour.key);
    if (!String(tour.name || "").trim()) return `Tour ${tour.key} needs a name.`;
    if (!String(tour.match || "").trim()) return `Tour ${tour.key} needs a report match pattern.`;
    if (!Array.isArray(tour.modes) || !tour.modes.every(m => m === "operational" || m === "nonop")) return `Tour ${tour.key} has invalid park modes.`;
  }
  const bytes = Buffer.byteLength(JSON.stringify(config), "utf8");
  if (bytes > MAX_BYTES) return "Tour config is too large.";
  return null;
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Allow": "GET, POST, OPTIONS" } });
  }

  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (req.method === "GET") {
    const entry = await store.getWithMetadata(CONFIG_KEY, { type: "json", consistency: "strong" });
    if (!entry) return json({ source: "builtin", config: null, etag: null, updatedAt: null });
    return json({ source: "shared", config: entry.data, etag: entry.etag, updatedAt: entry.metadata?.updatedAt || null });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!configuredPasswords().length) {
    return json({
      error: "Admin password is not configured. Add SHIFT_ADMIN_PASSWORD or ARRIVAL_DESK_ADMIN_PASSWORD in Netlify environment variables, include Functions scope if available, then redeploy.",
      code: "ADMIN_PASSWORD_NOT_CONFIGURED"
    }, 503);
  }
  if (!authorized(req)) return json({ error: "Incorrect admin password." }, 401);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  if (body?.action === "verify") return json({ ok: true });
  if (body?.action !== "save") return json({ error: "Unknown action." }, 400);

  const problem = validateConfig(body.config);
  if (problem) return json({ error: problem }, 400);

  const current = await store.getWithMetadata(CONFIG_KEY, { type: "json", consistency: "strong" });
  if (current && body.etag && current.etag !== body.etag) {
    return json({ error: "Tour config changed since this admin session loaded.", currentEtag: current.etag }, 409);
  }
  if (current && !body.etag) {
    return json({ error: "Reload the current shared config before saving.", currentEtag: current.etag }, 409);
  }

  const updatedAt = new Date().toISOString();
  const options = current
    ? { onlyIfMatch: current.etag, metadata: { updatedAt } }
    : { onlyIfNew: true, metadata: { updatedAt } };
  const result = await store.setJSON(CONFIG_KEY, body.config, options);
  if (!result.modified) return json({ error: "Config changed while saving. Reload and try again." }, 409);

  return json({ ok: true, etag: result.etag || null, updatedAt });
};

export const config = { path: "/api/tours" };
