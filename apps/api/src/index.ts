import { serve } from "@hono/node-server";
import { robinhood } from "@launchpad/shared";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, chainId: robinhood.id }));

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port });
console.log(`api: http://localhost:${port}`);
