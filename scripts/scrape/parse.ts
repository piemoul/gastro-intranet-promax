/**
 * Cheerio parsers for legacy HTML. The form parser is GENERIC: it reads every
 * named input/select/textarea and returns a flat map keyed by the Rails field
 * name with the `model[...]` wrapper stripped. This captures all 65 item fields
 * / 39 quotation fields without hardcoding any of them.
 */
import * as cheerio from "cheerio";

export type FormData = {
  model: string | null; // e.g. "item", "quotation", "customer"
  fields: Record<string, string>; // { sys_id: "...", model: "...", ... }
  selectedText: Record<string, string>; // for selects: the chosen option's visible text
  nested: Record<string, Record<string, string>[]>; // e.g. quotation_items_attributes[] rows
};

const FIELD_RE = /^([a-z_]+)\[([^\]]+)\](?:\[(\d+)\])?\[?([^\]]*)\]?/;

/** Parse a Rails edit form into a flat + nested field map. */
export function parseForm(html: string): FormData {
  const $ = cheerio.load(html);
  const fields: Record<string, string> = {};
  const selectedText: Record<string, string> = {};
  const nested: Record<string, Record<string, string>[]> = {};
  let model: string | null = null;

  $("form").find("input, select, textarea").each((_, el) => {
    const $el = $(el);
    const name = $el.attr("name");
    if (!name) return;
    if (/^(utf8|_method|authenticity_token|commit)$/.test(name)) return;

    const type = ($el.attr("type") ?? el.tagName).toLowerCase();
    if (type === "submit" || type === "button" || type === "file") return;

    let value = "";
    if (el.tagName.toLowerCase() === "select") {
      const sel = $el.find("option[selected]");
      value = (sel.attr("value") ?? "").toString();
      const txt = sel.text().trim();
      // record chosen text under the plain key later
      if (txt) selectedTextTmp(name, txt);
    } else if (type === "checkbox") {
      value = $el.attr("checked") != null ? "1" : "0";
    } else if (el.tagName.toLowerCase() === "textarea") {
      value = $el.text();
    } else {
      value = ($el.attr("value") ?? "").toString();
    }

    // model[field] or model[nested_attributes][i][field]
    const m = name.match(/^([a-z_]+)\[([a-z_0-9]+)\](?:\[(\d+)\])?(?:\[([a-z_0-9]+)\])?/);
    if (!m) {
      fields[name] = value;
      return;
    }
    const [, mdl, key1, idx, key2] = m;
    model ??= mdl;
    if (idx != null && key2) {
      // nested: model[key1][idx][key2]
      (nested[key1] ??= [])[Number(idx)] ??= {};
      nested[key1][Number(idx)][key2] = value;
    } else {
      fields[key1] = value;
    }
  });

  function selectedTextTmp(name: string, txt: string) {
    const m = name.match(/^[a-z_]+\[([a-z_0-9]+)\]/);
    if (m) selectedText[m[1]] = txt;
  }

  // compact nested arrays (remove empty holes)
  for (const k of Object.keys(nested)) nested[k] = nested[k].filter(Boolean);

  return { model, fields, selectedText, nested };
}

export type IndexRow = { cells: string[]; links: string[] };

/** Parse the first data table on an index page into rows of cell text + hrefs. */
export function parseIndexTable(html: string): { headers: string[]; rows: IndexRow[] } {
  const $ = cheerio.load(html);
  const table = $("table").first();
  const headers = table
    .find("thead th")
    .map((_, th) => $(th).text().trim())
    .get();
  const rows: IndexRow[] = table
    .find("tbody tr")
    .map((_, tr) => {
      const cells = $(tr)
        .find("td")
        .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
        .get();
      const links = $(tr)
        .find("a")
        .map((__, a) => $(a).attr("href") ?? "")
        .get()
        .filter(Boolean);
      return { cells, links };
    })
    .get();
  return { headers, rows };
}

/** Extract <option> value/text pairs from a named <select> (for taxonomy import). */
export function parseSelectOptions(
  html: string,
  selectNameContains: string,
): { value: string; text: string }[] {
  const $ = cheerio.load(html);
  const sel = $(`select[name*="${selectNameContains}"]`).first();
  return sel
    .find("option")
    .map((_, o) => ({ value: ($(o).attr("value") ?? "").toString(), text: $(o).text().trim() }))
    .get()
    .filter((o) => o.value !== "");
}

/** Parse a "Name | Price/Multiplier | action" sub-resource table (buy_prices, cost_multis). */
export function parseNameValueTable(html: string): { name: string; value: string; isDefault: boolean }[] {
  const { rows } = parseIndexTable(html);
  return rows.map((r) => ({
    name: r.cells[0] ?? "",
    value: r.cells[1] ?? "",
    isDefault: !/Make Default/i.test(r.cells[2] ?? ""), // "Make Default" link shown on the NON-default rows
  }));
}
