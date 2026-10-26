# Handoff pull Koindra: SQ, Manage Items dan integrasi

Paket 26 Oktober 2026 ditujukan untuk di-pull dari `piemoul/gastro-intranet-promax` branch `main` ke checkout Koindra. Push ke Piemoul hanya menjalankan verifikasi; job deployment pada workflow dibatasi ke repository `ko-indra/gastro-intranet`. Tidak ada deployment Koindra yang dijalankan dari mesin ini.

## Perubahan environment yang harus diperhatikan

Fitur komersial terakhir tidak menambah nama env baru. Dibanding `piemoul/main` sebelum paket ini (`e1ac71f`), milestone Portal/WMS menambah konfigurasi berikut. Nilai privat tidak disertakan di Git.

| Lokasi | Variabel | Pengaturan pada mesin live |
| --- | --- | --- |
| Intranet `.env.local` / environment hosting | `INTRANET_PORTAL_API_URL` | URL endpoint Gastro Portal `/api/integrations/intranet`. Lokal Docker memakai `http://host.docker.internal:3035/api/integrations/intranet`. |
| Intranet | `INTRANET_PORTAL_API_KEY` | Secret server-to-server yang sama dengan Gastro Web/Portal, minimal 32 karakter. |
| Intranet | `INTRANET_WMS_API_URL` | URL API baca WMS `/v1/catalog`. Dalam Compose yang disertakan: `http://wms-read-api:3110/v1/catalog`. |
| Intranet | `INTRANET_WMS_API_KEY` | Secret yang sama dengan `WMS_READ_API_KEY` pada layanan baca WMS, minimal 32 karakter. |
| Layanan baca WMS, `.env.wms-read.local` | `WMS_READ_DATABASE_URL` | Koneksi database WMS untuk katalog/stok. Query layanan berjalan dalam transaksi READ ONLY; tidak menggunakan autentikasi pengguna WMS. |
| Layanan baca WMS | `WMS_READ_API_KEY` | Secret pasangan `INTRANET_WMS_API_KEY`. |
| Gastro Web/Portal, environment project tersebut | `INTRANET_PORTAL_API_KEY` | Secret pasangan Intranet. Tetap gunakan konfigurasi Baserow Portal yang sudah ada. |

`host.docker.internal` dan `wms-read-api` adalah alamat deployment lokal/Docker, bukan alamat yang bisa dipakai Vercel secara langsung. Bila Koindra menjalankan Intranet di Vercel/host lain, isi kedua URL API dengan endpoint HTTPS yang dapat dijangkau server hosting tersebut dan tetap dilindungi bearer key. File `.env.wms-read.local` hanya diperlukan pada host yang menjalankan layanan baca WMS.

Konfigurasi yang sudah ada tetap diperlukan: `APP_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ACCURATE_HOST`, `ACCURATE_SIGNATURE_KEY`, `ACCURATE_API_TOKEN` (GGS), `ACCURATE_API_TOKEN_RSP` (RSP), dan `ACCURATE_API_TOKEN_SARANA` (SRI). Lima variabel Accurate berasal dari `.env.local` Intranet sendiri; runtime tidak lagi bergantung pada file env WMS. Jangan menyalin nilai privat melalui commit.

`APP_URL` live harus mengikuti domain Koindra dan redirect OAuth harus persis `<APP_URL>/api/auth/google/callback`. Domain lokal pada mesin ini adalah `https://intranet.davay.space`; tidak perlu mengganti domain live Koindra dengan domain tersebut. Secret OAuth tambahan yang sebelumnya dibuat untuk Docker tetap privat dan bukan bagian dari paket Git ini.

Untuk Neon/Vercel, isi `DATABASE_URL` pada hosting. Objek baru dibuat otomatis saat modul digunakan dan seluruh objek PostgreSQL Intranet memakai awalan `intranet_`. Compose yang disertakan sengaja mengosongkan `DATABASE_URL`, `INTRANET_TEST_DATABASE_URL` dan `INTRANET_WMS_ENV_FILE`, serta memakai `/app/.data` dalam volume persisten. Jangan menghapus volume atau mengganti pilihan database tanpa membawa data Intranet yang diperlukan. Harga, kurs, template, pemetaan, whitelist dan draft lokal bukan bagian dari Git.

## Dependensi Gastro Web/Portal

Endpoint minimal directory/katalog berasal dari commit Gastro Web `167f7b8` (`app/api/integrations/intranet/route.ts`). Karena kode itu berada di project berbeda, salinan patch tanpa credential disertakan pada [integrations/gastro-web/intranet-api.patch](../integrations/gastro-web/intranet-api.patch). Tidak ada perubahan project Web lain yang dikemas.

Jika endpoint belum ada, jalankan dari checkout Gastro Web yang sudah mempunyai Gastro Portal/Baserow dan curated catalogue:

```sh
git apply --check /path/to/gastro-intranet-promax/integrations/gastro-web/intranet-api.patch
git apply /path/to/gastro-intranet-promax/integrations/gastro-web/intranet-api.patch
```

Route memakai `listBaserowEmployees` dari `@/lib/absensi/baserow` dan `curatedSkus` dari `@/lib/curated-catalogue`. Pastikan kedua modul cocok dengan project Web live, isi env Portal di atas, lalu jalankan pemeriksaan/build/deployment project Web. Jika endpoint sudah ada, bandingkan implementasinya; jangan menerapkan patch dua kali.

## Urutan deployment dan pemeriksaan

1. Pull `piemoul/main` ke branch kerja Koindra dan tinjau perubahan. Tidak perlu force push. Untuk upstream Koindra, tetap gunakan proses review/deployment yang biasa dipakai.
2. Siapkan endpoint Portal, layanan baca WMS dan pasangan key pada host yang dituju. `.env.example` hanya template; `.env.local` dan `.env.wms-read.local` harus diisi melalui jalur privat.
3. Untuk Docker, setelah kedua file env tersedia: `docker compose up -d --build wms-read-api app`. Untuk Vercel, siapkan URL API HTTPS yang dapat dijangkau dan `DATABASE_URL` sebelum menerbitkan aplikasi.
4. Login Super Admin, sinkronkan direktori Portal, periksa akses PT, lalu baca SKU/stok, klien, supplier, cabang/mata uang/termin untuk ketiga PT. Verifikasi tanpa login harus ditolak. Daftar Super Admin Portal tetap pasangan ID/email yang sudah ditetapkan; role ADMIN Portal tidak otomatis memberi hak Intranet.
5. Periksa scope Accurate yang diperlukan sebelum penggunaan bisnis. Penambahan klien memerlukan `customer_save`; izin baca yang berhasil tidak membuktikan izin tulis. Tidak membuat klien/SQ/SO/PO percobaan. Approval dan publikasi memakai reservasi durable serta satu pengiriman; hasil tidak pasti dikunci untuk rekonsiliasi baca.

Validasi paket: lint/typecheck/build Linux, 95 tes lulus dan dua suite PostgreSQL dijalankan terpisah pada database terisolasi. Semua write Accurate dalam tes memakai mock. Browser memeriksa pilihan SKU WMS/Accurate dan fitur komersial; halaman cetak memakai fixture terpisah tanpa credential Accurate. Lihat [peta fitur dan bukti verifikasi](intra-functional-parity-plan.md).
