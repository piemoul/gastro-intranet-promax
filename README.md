# Gastro Intranet

Ruang kerja PO, SQ/SO, master barang, dan master klien untuk tiga PT Gastro. Tampilan mengikuti Gastro WMS. **SQ lengkap disimpan ke Accurate oleh sales atau kepala sales; hanya SQ terpilih dapat dilanjutkan menjadi SO. PO/SO baru dapat dibuat di Accurate pada tahap akhir setelah persetujuan dan konfirmasi kepala bagian.** Master serta dokumen Accurate yang sudah ada tetap hanya dibaca; usulan perubahannya tetap lokal.

## Kemampuan saat ini

- Google Sign-In, whitelist email, master admin `malesmikirbos@gmail.com`, pengelolaan empat role melalui dropdown, dan pilihan akses PT.
- Sales: draft dan penerbitan SQ miliknya. Kepala sales: pemilihan SQ Accurate, persetujuan internal SO, turunan SO lokal, usulan edit SO Accurate, serta usulan tambah/edit klien.
- Importer: draft PO miliknya. Kepala importer: persetujuan internal PO serta usulan tambah/edit master barang.
- Master admin dapat mengelola seluruh fitur dan pengguna. Staff hanya melihat dokumen lokal miliknya; kepala bagian melihat timnya. Dokumen Accurate dibaca oleh kepala bagian sesuai bidangnya.
- Pencarian barang, customer, vendor, dan transaksi live di Accurate; pemisahan PT; nomor dokumen `LOCAL-...` untuk draft; audit; versi dokumen; pencegahan duplikasi saat retry.
- Identitas asli baris Accurate, proyek, departemen, custom fields, diskon dan dasar pajak dipertahankan pada usulan yang didukung. Total formulir merupakan estimasi, belum perhitungan final Accurate.

**Persetujuan internal belum otomatis menerbitkan transaksi ke Accurate.** Pilih **Buat SO Accurate** atau **Buat PO Accurate** pada draft yang telah disetujui. Nomor mengikuti penomoran Accurate. Dokumen yang sedang dikirim, sudah terbit, atau hasilnya belum pasti dikunci dari edit, penurunan ke SQ, dan pengiriman ulang. Hasil tidak pasti diperiksa dengan nomor Accurate; pencocokan wajib menggunakan penanda percobaan, PT, mitra, barang, dan nilai dokumen. Lihat [alur penerbitan dan batas field](docs/accurate-publication.md). SO Accurate tidak dapat dimundurkan, dibatalkan, atau dihapus pada tahap ini. SO lokal yang diturunkan dari SQ dapat dikembalikan menjadi referensi SQ Accurate asal dengan jejak hubungan. Dokumen sumber setelah memiliki turunan dibekukan untuk mencegah dua versi aktif.

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

Catatan internal SO disimpan dan diaudit hanya di Intranet; tidak dimasukkan ke payload Accurate. Satu SQ hanya dapat memiliki satu SO aktif di Intranet. Pemilihan SQ serta publikasi SO memeriksa ulang perusahaan, identitas SQ, pelanggan, mata uang, barang, satuan dan jumlah yang tersedia.
