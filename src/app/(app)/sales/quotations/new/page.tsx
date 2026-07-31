import { can } from "@/server/auth/guard";
import { Forbidden } from "@/components/forbidden";
import { PageHeader } from "@/components/page-header";
import { AutoForm } from "@/components/auto-form";
import { quotationFields } from "@/server/forms/quotation-fields";
import { createQuotation } from "@/server/actions/quotations";

export default async function NewQuotationPage() {
  if (!(await can("Quotation", "create"))) return <Forbidden what="pembuatan quotation" />;
  const fields = await quotationFields();

  return (
    <div>
      <PageHeader title="Quotation Baru" subtitle="Isi header, lalu tambahkan item pada langkah berikutnya" />
      <AutoForm
        fields={fields}
        values={{ qStatus: "DRAFT", qLang: "ID", qCurrency: "IDR", qDate: new Date().toISOString().slice(0, 10) }}
        action={createQuotation}
        submitLabel="Simpan & Lanjut ke Items"
        cancelHref="/sales/quotations"
      />
    </div>
  );
}
