import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import postgres from "postgres";

const sql = postgres(process.env.WMS_READ_DATABASE_URL, { max: 3, prepare: false, connect_timeout: 10, onnotice: () => {} });
const key = process.env.WMS_READ_API_KEY || "";
if (key.length < 32 || !process.env.WMS_READ_DATABASE_URL) throw new Error("WMS read API configuration missing");
const server = http.createServer(async (req, res) => {
  const send = (status, value) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(value)); };
  const supplied = req.headers.authorization?.replace(/^Bearer /, "") || "";
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(key) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(key))) return send(401, { error: "Unauthorized" });
  const url = new URL(req.url, "http://wms-read-api");
  if (req.method !== "GET" || url.pathname !== "/v1/catalog") return send(405, { error: "Read-only API" });
  const company = Number(url.searchParams.get("companyId"));
  const search = (url.searchParams.get("search") || "").trim().slice(0, 150);
  const brand = (url.searchParams.get("brand") || "").trim().slice(0, 150);
  const model = (url.searchParams.get("model") || "").trim().slice(0, 150);
  const code = (url.searchParams.get("code") || "").trim().slice(0, 150);
  const page = Math.min(10000, Math.max(1, Number(url.searchParams.get("page")) || 1));
  if (![1, 2, 3].includes(company) || !Number.isInteger(page)) return send(400, { error: "Invalid company or page" });
  try {
    const data = await sql.begin("READ ONLY", async tx => {
      await tx`SET LOCAL statement_timeout = '8000ms'`;
      // Every SQL statement is fixed, parameterized and scoped to the PT. No WMS writes.
      const brands = await tx`SELECT DISTINCT merk AS name FROM item_catalog WHERE company_id=${company} AND trim(merk)<>'' AND upper(coalesce(classification::text,'')) NOT LIKE '%CUSTOM%' ORDER BY name`;
      const models = brand ? await tx`SELECT DISTINCT model AS name FROM item_catalog WHERE company_id=${company} AND merk=${brand} AND trim(model)<>'' AND upper(coalesce(classification::text,'')) NOT LIKE '%CUSTOM%' ORDER BY name` : [];
      const items = await tx`SELECT c.id::text, c.kode AS code, c.nama AS name, c.merk AS brand, c.model,
        coalesce(c.unit_name,'') AS unit, coalesce(c.classification::text,'') AS classification
        FROM item_catalog c WHERE c.company_id=${company} AND upper(coalesce(c.classification::text,'')) NOT LIKE '%CUSTOM%'
        AND (${brand}='' OR c.merk=${brand}) AND (${model}='' OR c.model=${model}) AND (${code}='' OR c.kode=${code})
        AND (${search}='' OR position(lower(${search}) in lower(concat_ws(' ',c.kode,c.nama,c.merk,c.model)))>0)
        ORDER BY c.kode,c.id LIMIT 25 OFFSET ${(page-1)*24}`;
      const visible = items.slice(0,24);
      const codes=visible.map(i=>i.code);
      if(codes.length){
        // Subtract bookings independently per warehouse and serial/nonserial pool.
        const stock = await tx`WITH physical AS (
          SELECT kode,warehouse_id,is_serialized,sum(CASE WHEN is_serialized THEN 1 ELSE qty END)::float AS qty FROM item
          WHERE company_id=${company} AND kode=ANY(${codes}) AND lifecycle='in_stock' AND cancelled_at IS NULL AND status_outbound='none'
          GROUP BY kode,warehouse_id,is_serialized
        ), booked AS (
          SELECT kode,warehouse_id,is_serialized,sum(qty)::float AS qty FROM stock_booking WHERE company_id=${company} AND kode=ANY(${codes}) GROUP BY kode,warehouse_id,is_serialized
        ) SELECT coalesce(p.kode,b.kode) AS code,w.id AS "warehouseId",w.name AS warehouse,cw.accurate_name AS "accurateWarehouse",
          sum(coalesce(p.qty,0))::float AS "onHand",sum(coalesce(b.qty,0))::float AS booked,
          sum(greatest(0,coalesce(p.qty,0)-coalesce(b.qty,0)))::float AS available
          FROM physical p FULL JOIN booked b USING(kode,warehouse_id,is_serialized)
          JOIN warehouse w ON w.id=coalesce(p.warehouse_id,b.warehouse_id)
          JOIN company_warehouse cw ON cw.warehouse_id=w.id AND cw.company_id=${company} AND cw.active=true
          GROUP BY coalesce(p.kode,b.kode),w.id,w.name,cw.accurate_name ORDER BY w.name`;
        for(const item of visible){item.stock=stock.filter(s=>s.code===item.code);item.available=item.stock.reduce((n,s)=>n+s.available,0);}
      }
      return { companyId: company, brands: brands.map(b=>b.name), models: models.map(m=>m.name), items:visible, hasMore:items.length>24, page, fetchedAt:new Date().toISOString() };
    });
    send(200, data);
  } catch { send(503, { error: "Data WMS belum tersedia. Coba kembali." }); }
});
server.listen(Number(process.env.PORT || 3110), "0.0.0.0");
process.on("SIGTERM", async () => { server.close(); await sql.end({timeout:3}); });
