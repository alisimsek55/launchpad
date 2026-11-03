import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { robinhood } from "@launchpad/shared";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, normalizeTelegram, normalizeX, validate, type TokenMetadata } from "./metadata";
import { getStorage, readLocal, useR2 } from "./storage";

const app = new Hono();
app.use("*", cors({ origin: process.env.WEB_ORIGIN ?? "*" }));

app.get("/health", (c) => c.json({ ok: true, chainId: robinhood.id, storage: useR2 ? "r2" : "local" }));

/// Token metadata + görsel yükleme. Dönen `uri`, TokenFactory.createToken'a metadataURI olarak verilir.
app.post("/metadata", bodyLimit({ maxSize: MAX_IMAGE_BYTES + 64 * 1024 }), async (c) => {
  const form = await c.req.formData();
  const field = (k: string) => String(form.get(k) ?? "").trim();
  const input = {
    name: field("name"),
    symbol: field("symbol"),
    description: field("description"),
    x: field("x"),
    telegram: field("telegram"),
    website: field("website"),
  };
  const err = validate(input);
  if (err) return c.json({ error: err }, 400);

  const image = form.get("image");
  if (!(image instanceof File)) return c.json({ error: "Görsel gerekli" }, 400);
  const ext = IMAGE_TYPES[image.type];
  if (!ext) return c.json({ error: "Görsel PNG, JPG, WEBP veya GIF olmalı" }, 400);
  if (image.size > MAX_IMAGE_BYTES) return c.json({ error: "Görsel en fazla 5 MB" }, 400);

  const id = randomUUID();
  const storage = await getStorage();
  const imageUrl = await storage.put(`images/${id}.${ext}`, new Uint8Array(await image.arrayBuffer()), image.type);
  const metadata: TokenMetadata = {
    name: input.name,
    symbol: input.symbol,
    description: input.description,
    image: imageUrl,
    x: normalizeX(input.x),
    telegram: normalizeTelegram(input.telegram),
    website: input.website || undefined,
  };
  const uri = await storage.put(
    `metadata/${id}.json`,
    new TextEncoder().encode(JSON.stringify(metadata)),
    "application/json",
  );
  return c.json({ uri, image: imageUrl });
});

/// Yerel depo için dosya sunumu (R2 kullanılıyorsa dosyalar CDN'den gelir).
app.get("/files/*", async (c) => {
  const key = c.req.path.replace(/^\/files\//, "");
  const body = await readLocal(key);
  if (!body) return c.notFound();
  const ext = key.split(".").pop() ?? "";
  const type =
    ext === "json" ? "application/json" : (Object.entries(IMAGE_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream");
  return c.body(new Uint8Array(body), 200, { "content-type": type, "cache-control": "public, max-age=31536000, immutable" });
});

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port });
console.log(`api: http://localhost:${port} (storage: ${useR2 ? "r2" : "local"})`);
