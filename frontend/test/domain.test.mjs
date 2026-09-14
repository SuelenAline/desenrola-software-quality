import assert from "node:assert/strict";
import { it } from "node:test";
import http from "node:http";
import { createServer } from "../server.mjs";
import {
  escapeHtml,
  parseAmount,
  totals,
  filterTransactions,
} from "../public/domain.js";

it("parses Brazilian amounts without silently losing precision", () => {
  assert.equal(parseAmount("12,34"), 12.34);
  assert.equal(parseAmount("0"), 0);
  assert.equal(parseAmount("99999999.99"), 99999999.99);
  for (const value of [
    "",
    "-1",
    "1,234",
    "1.234,56",
    "1e3",
    "100000000",
    "Infinity",
  ])
    assert.throws(() => parseAmount(value));
});
it("aggregates monetary values in integer cents", () => {
  assert.deepEqual(
    totals([
      { amount: "0.10", type: "Receita" },
      { amount: "0.20", type: "Receita" },
      { amount: "0.10", type: "Despesa" },
    ]),
    { income: 0.3, expense: 0.1, balance: 0.2 },
  );
});
it("filters description and transaction type together", () => {
  const rows = [
    { description: "Mercado", type: "Despesa" },
    { description: "Salário", type: "Receita" },
  ];
  assert.deepEqual(filterTransactions(rows, " MER ", "Despesa"), [rows[0]]);
  assert.deepEqual(filterTransactions(rows, "mer", "Receita"), []);
});
it("escapes user-controlled text and attributes", () => {
  assert.equal(
    escapeHtml("<img src=\"x\" onerror='x'> &"),
    "&lt;img src=&quot;x&quot; onerror=&#39;x&#39;&gt; &amp;",
  );
});
const listen = (server) =>
  new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve(`http://127.0.0.1:${server.address().port}`),
    ),
  );
const close = (server) =>
  new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  });
it("serves only public assets and proxies authenticated JSON to the fixed backend", async () => {
  let captured;
  const backend = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    captured = {
      url: req.url,
      method: req.method,
      authorization: req.headers.authorization,
      forwarded: req.headers["x-forwarded-for"],
      body,
    };
    res.writeHead(201, { "content-type": "application/json" });
    res.end('{"id":1}');
  });
  const backendUrl = await listen(backend);
  const frontend = createServer(backendUrl);
  const origin = await listen(frontend);
  try {
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(
      page.headers.get("content-security-policy"),
      /script-src 'self'/,
    );
    for (const path of ["/.env", "/server.mjs", "/package.json", "/api"])
      assert.equal((await fetch(origin + path)).status, 404);
    const response = await fetch(origin + "/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test",
        "x-forwarded-for": "forged",
      },
      body: '{"amount":1}',
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { id: 1 });
    assert.deepEqual(captured, {
      url: "/transactions",
      method: "POST",
      authorization: "Bearer test",
      forwarded: undefined,
      body: '{"amount":1}',
    });
  } finally {
    await close(frontend);
    await close(backend);
  }
});
it("returns an actionable error when the API is unavailable", async () => {
  const unused = http.createServer();
  const origin = await listen(unused);
  await close(unused);
  const frontend = createServer(origin);
  const url = await listen(frontend);
  try {
    const response = await fetch(url + "/api/transactions");
    assert.equal(response.status, 502);
    assert.match((await response.json()).message, /backend/);
  } finally {
    await close(frontend);
  }
});
