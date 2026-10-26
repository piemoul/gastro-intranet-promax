---
type: "query"
date: "2026-10-26T03:54:25.962Z"
question: "Apakah credential Accurate Intranet ketiga PT sudah tersedia dari WMS pada 25 Oktober 2026?"
contributor: "graphify"
---

# Q: Apakah credential Accurate Intranet ketiga PT sudah tersedia dari WMS pada 25 Oktober 2026?

## Answer

Catatan historis: pemeriksaan ini dilakukan sebelum migrasi ke konfigurasi Accurate mandiri. Status deployment terkini mengikuti `docs/environment.md`; Compose sekarang memakai key dari `.env.local` Intranet tanpa mount file WMS.

Diperiksa pada 25 Oktober 2026 waktu America/Los_Angeles. Effective configuration container gastro-intranet memiliki ACCURATE_HOST, ACCURATE_SIGNATURE_KEY dan tiga token perusahaan. File WMS dipasang read-only pada /run/intranet/wms.env melalui INTRANET_WMS_ENV_FILE; kelima nilai sesuai sumber WMS, tidak ada override kosong, dan ketiga token berbeda. Enam GET allowlist untuk satu ID barang dan klien per PT berhasil. Tidak perlu menyalin ulang key, tidak mengubah environment/container/backend, tidak membuat transaksi. Laporan privat tanpa nilai credential: .logs/accurate-environment-check.json.
