import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type QuotationPdfData = {
  qCode: string;
  company: string; // SARANA | GASTRO | RSP
  lang: string; // "ID" | "EN" | ...
  subject: string | null;
  date: string | null;
  customer: string | null;
  customerPic: string | null;
  salesName: string | null;
  status: string | null;
  lines: { label: string; qty: string; currency: string; unit: string; subtotalIdr: string }[];
  totalIdr: string;
  terms: { label: string; value: string }[];
};

const ENTITY_NAME: Record<string, string> = {
  SARANA: "PT GASTRO GIZI SARANA",
  GASTRO: "PT GASTRO",
  RSP: "PT RSP",
};

// Minimal i18n so q_lang drives the visible labels.
const L: Record<string, Record<string, string>> = {
  ID: { quotation: "PENAWARAN HARGA", to: "Kepada", date: "Tanggal", item: "Item", qty: "Qty", price: "Harga", subtotal: "Subtotal", total: "Total (exc. PPN)", terms: "Syarat & Ketentuan" },
  EN: { quotation: "QUOTATION", to: "To", date: "Date", item: "Item", qty: "Qty", price: "Price", subtotal: "Subtotal", total: "Total (excl. VAT)", terms: "Terms & Conditions" },
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1f2937", fontFamily: "Helvetica" },
  brand: { fontSize: 15, fontWeight: 700, color: "#1d406f" },
  sub: { fontSize: 8, color: "#6b7280", marginTop: 2, textTransform: "uppercase" },
  title: { fontSize: 12, fontWeight: 700, marginTop: 14, color: "#111827" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  metaBox: { width: "48%" },
  label: { color: "#6b7280", fontSize: 8 },
  value: { marginBottom: 3 },
  th: { flexDirection: "row", backgroundColor: "#1d406f", color: "#fff", paddingVertical: 4, paddingHorizontal: 4, marginTop: 14 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingVertical: 4, paddingHorizontal: 4 },
  cItem: { width: "46%" },
  cQty: { width: "10%", textAlign: "right" },
  cCur: { width: "12%", textAlign: "center" },
  cPrice: { width: "16%", textAlign: "right" },
  cSub: { width: "16%", textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  totalBox: { backgroundColor: "#f1f5fb", padding: 8, minWidth: 180, textAlign: "right" },
  totalLabel: { fontSize: 8, color: "#6b7280" },
  totalVal: { fontSize: 13, fontWeight: 700, color: "#1d406f" },
  terms: { marginTop: 16 },
  termRow: { flexDirection: "row", marginBottom: 2 },
  termLabel: { width: 90, color: "#6b7280" },
});

function idr(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? "IDR " + n.toLocaleString("id-ID", { maximumFractionDigits: 0 }) : v;
}

export function QuotationPdf({ data }: { data: QuotationPdfData }) {
  const t = L[data.lang?.toUpperCase()] ?? L.ID;
  return (
    <Document title={data.qCode}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>{ENTITY_NAME[data.company] ?? "PT GASTRO GIZI SARANA"}</Text>
        <Text style={styles.sub}>Commercial Kitchen Equipment</Text>

        <Text style={styles.title}>
          {t.quotation} — {data.qCode}
        </Text>
        {data.subject ? <Text style={{ marginTop: 2 }}>{data.subject}</Text> : null}

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.label}>{t.to}</Text>
            <Text style={styles.value}>{data.customer ?? "—"}</Text>
            {data.customerPic ? <Text style={styles.value}>{data.customerPic}</Text> : null}
          </View>
          <View style={styles.metaBox}>
            <Text style={styles.label}>{t.date}</Text>
            <Text style={styles.value}>{data.date ?? "—"}</Text>
            <Text style={styles.label}>Sales</Text>
            <Text style={styles.value}>{data.salesName ?? "—"}</Text>
          </View>
        </View>

        <View style={styles.th}>
          <Text style={styles.cItem}>{t.item}</Text>
          <Text style={styles.cQty}>{t.qty}</Text>
          <Text style={styles.cCur}>Cur</Text>
          <Text style={styles.cPrice}>{t.price}</Text>
          <Text style={styles.cSub}>{t.subtotal}</Text>
        </View>
        {data.lines.map((ln, i) => (
          <View style={styles.tr} key={i}>
            <Text style={styles.cItem}>{ln.label}</Text>
            <Text style={styles.cQty}>{ln.qty}</Text>
            <Text style={styles.cCur}>{ln.currency}</Text>
            <Text style={styles.cPrice}>{Number(ln.unit).toLocaleString("id-ID")}</Text>
            <Text style={styles.cSub}>{idr(ln.subtotalIdr)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>{t.total}</Text>
            <Text style={styles.totalVal}>{idr(data.totalIdr)}</Text>
          </View>
        </View>

        {data.terms.length > 0 && (
          <View style={styles.terms}>
            <Text style={{ fontWeight: 700, marginBottom: 4 }}>{t.terms}</Text>
            {data.terms.map((term, i) => (
              <View style={styles.termRow} key={i}>
                <Text style={styles.termLabel}>{term.label}</Text>
                <Text style={{ flex: 1 }}>{term.value}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
