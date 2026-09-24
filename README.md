# Gastro Intranet

Ruang kerja PO, SQ/SO, master barang, dan master klien untuk tiga PT Gastro. Tampilan mengikuti Gastro WMS. **Seluruh akses Accurate pada fase ini hanya membaca.** Tidak ada endpoint simpan/hapus Accurate maupun tombol pengaktifan mode tulis.

## Kemampuan saat ini

- Google Sign-In, whitelist email, master admin `malesmikirbos@gmail.com`, pengelolaan empat role melalui dropdown, dan pilihan akses PT.
- Sales: draft SQ miliknya. Kepala sales: peninjauan SQ, persetujuan internal, turunan SO lokal, usulan edit SO Accurate, serta usulan tambah/edit klien.
- Importer: draft PO miliknya. Kepala importer: persetujuan internal PO serta usulan tambah/edit master barang.
- Master admin dapat mengelola seluruh fitur dan pengguna. Staff hanya melihat dokumen lokal miliknya; kepala bagian melihat timnya. Dokumen Accurate dibaca oleh kepala bagian sesuai bidangnya.
- Pencarian barang, customer, vendor, dan transaksi live di Accurate; pemisahan PT; nomor dokumen `LOCAL-...` untuk draft; audit; versi dokumen; pencegahan duplikasi saat retry.
- Identitas asli baris Accurate, proyek, departemen, custom fields, diskon dan dasar pajak dipertahankan pada usulan yang didukung. Total formulir merupakan estimasi, belum perhitungan final Accurate.

**Persetujuan internal belum menerbitkan transaksi ke Accurate.** SO Accurate tidak dapat dimundurkan, dibatalkan, atau dihapus pada tahap ini. SO lokal yang diturunkan dari SQ dapat dikembalikan menjadi draft SQ lokal dengan jejak hubungan. Dokumen sumber setelah memiliki turunan dibekukan untuk mencegah dua versi aktif.

## Menjalankan lokal

Node.js 24 diperlukan.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3100`. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, dan `DATABASE_URL` di `.env.local`. Kredensial Accurate lokal dibaca dari `INTRANET_WMS_ENV_FILE`; deployment memakai environment variables Vercel. Jangan menaruh rahasia di variabel `NEXT_PUBLIC_*`.

Dengan `DATABASE_URL`, aplikasi memakai Neon yang sama dengan WMS tetapi **hanya tabel, trigger, fungsi, dan indeks berawalan `intranet_`**. Migrasi menambah tabel Intranet, tanpa mengubah tabel WMS. Whitelist, sesi, draft, dan audit bertahan antar-deployment. Tanpa `DATABASE_URL`, penyimpanan SQLite lokal di `.data` dipakai untuk pengembangan/pengujian; Vercel menolak konfigurasi database yang kosong.

## Pengujian

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tes biasa menggunakan fixture lokal tanpa menghubungi Google/Accurate. Tes PostgreSQL hanya aktif jika `INTRANET_TEST_DATABASE_URL` disediakan eksplisit, memakai schema sementara dengan assertion isolasi, kemudian membersihkan schema tersebut. Jangan memasang variabel pengujian database ke Vercel.

Riset live Accurate dilakukan melalui `npm run research`, tetap GET-only. Sampel privat tersimpan di `.data/research` dan dikecualikan dari Git/deployment.

## Referensi

- [Hasil riset 3 PT](docs/accurate-research.md)
- [Matriks field dan keterbatasan](docs/accurate-field-matrix.md)
- [Google Sign-In dan whitelist](docs/google-sign-in.md)
- [CI/CD](docs/deployment-pipeline.md)

Penulisan transaksi/master ke Accurate, penanganan dokumen komersial yang ditandai tidak didukung, dan pemeriksaan dependensi WMS secara lengkap perlu tahap implementasi berikutnya. Source warning ditampilkan sebagai batasan; aplikasi tidak mengklaim dokumen siap diterbitkan hanya karena draft lokal disetujui.
