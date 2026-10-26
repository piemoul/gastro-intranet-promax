# Gastro Intranet

Repository ini dilanjutkan di [piemoul/gastro-intranet-promax](https://github.com/piemoul/gastro-intranet-promax), dengan deployment Docker Desktop melalui [intranet.davay.space](https://intranet.davay.space). Source dan histori awal berasal dari `ko-indra/gastro-intranet`.

Ruang kerja PO, SQ/SO, master barang, dan master klien untuk tiga PT Gastro. Tampilan mengikuti Gastro WMS. **SQ dimulai dari permintaan barang/jumlah sales, dilengkapi admin, lalu disetujui dan diterbitkan ke Accurate hanya oleh Super Admin; hanya SQ terpilih dapat dilanjutkan menjadi SO. PO/SO baru dapat dibuat di Accurate pada tahap akhir setelah persetujuan dan konfirmasi kepala bagian.** Master serta dokumen Accurate yang sudah ada tetap hanya dibaca; usulan perubahannya tetap lokal.

## Kemampuan saat ini

- Google Sign-In, whitelist email, master admin `malesmikirbos@gmail.com`, pengelolaan empat role melalui dropdown, dan pilihan akses PT.
- Sales: permintaan barang/jumlah dan pengajuan review SQ miliknya melalui katalog WMS. Kepala sales: review harga SQ, pemilihan SQ Accurate, persetujuan internal SO, turunan SO lokal, dan usulan edit SO Accurate. Klien baru Accurate hanya dapat dibuat Super Admin melalui draft, approval dan konfirmasi akhir.
- Importer: draft PO miliknya. Kepala importer: persetujuan internal PO serta usulan tambah/edit master barang.
- Master admin dapat mengelola seluruh fitur dan pengguna. Staff hanya melihat dokumen lokal miliknya; kepala bagian melihat timnya. Dokumen Accurate dibaca oleh kepala bagian sesuai bidangnya.
- Pencarian barang, customer, vendor, dan transaksi live di Accurate; pemisahan PT; nomor dokumen `LOCAL-...` untuk draft; audit; versi dokumen; pencegahan duplikasi saat retry.
- Identitas asli baris Accurate, proyek, departemen, custom fields, diskon dan dasar pajak dipertahankan pada usulan yang didukung. Total formulir merupakan estimasi, belum perhitungan final Accurate.
- Manage Items memilih SKU Accurate/WMS PT aktif, dengan pemetaan eksplisit bila kode berbeda. Super Admin mengatur tier 0–5, buy prices, cost multipliers, biaya cabang, spesifikasi dan supplier; master sumber tidak ditulis.
- Pengaturan kurs/terms per PT, penerapan pricebook, analisis margin reviewer, duplikasi/revisi lokal, tindak lanjut, laporan CSV dan cetak penawaran ID/EN. Lihat [pemetaan dan implementasi fungsi Intra](docs/intra-functional-parity-plan.md).

**Persetujuan internal belum otomatis menerbitkan transaksi ke Accurate.** Pilih **Buat SO Accurate** atau **Buat PO Accurate** pada draft yang telah disetujui. Nomor mengikuti penomoran Accurate. Dokumen yang sedang dikirim, sudah terbit, atau hasilnya belum pasti dikunci dari edit, penurunan ke SQ, dan pengiriman ulang. Hasil tidak pasti diperiksa dengan nomor Accurate; pencocokan wajib menggunakan penanda percobaan, PT, mitra, barang, dan nilai dokumen. Lihat [alur penerbitan dan batas field](docs/accurate-publication.md). SO Accurate tidak dapat dimundurkan, dibatalkan, atau dihapus pada tahap ini. SO lokal yang diturunkan dari SQ dapat dikembalikan menjadi referensi SQ Accurate asal dengan jejak hubungan. Dokumen sumber setelah memiliki turunan dibekukan untuk mencegah dua versi aktif.

## Menjalankan lokal

Node.js 24 diperlukan.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3100`. Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, dan kelima variabel Accurate di `.env.local`. Compose memakai konfigurasi Accurate milik Intranet sendiri tanpa mount file environment WMS. `DATABASE_URL` hanya diperlukan jika memilih PostgreSQL/Neon. Jangan menaruh rahasia di variabel `NEXT_PUBLIC_*`.

Untuk Docker Desktop, setelah mengisi `.env.local`, jalankan `docker compose --env-file .env.local up -d --build app`. Compose memakai SQLite dalam volume persisten. Lihat [environment, OAuth, Accurate, dan operasi Docker](docs/environment.md).

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
- [Environment dan deployment Docker](docs/environment.md)
- [Peta proyek dan Graphify](docs/project-map.md)
- [Verifikasi pembacaan Accurate ketiga PT](docs/accurate-connection-check.md)
- [Referensi dan pemeriksaan UX responsif](docs/ui-responsive-review.md)

SQ/SO/PO baru dan klien baru memiliki layanan publikasi terbatas dengan reservasi sebelum kirim. Edit master/dokumen Accurate yang sudah ada, publikasi master barang, field komersial yang ditandai tidak didukung, dan pemeriksaan dependensi WMS lengkap tetap di luar kemampuan publikasi. Source warning ditampilkan sebagai batasan; approval tidak otomatis mengirim data ke Accurate.

Catatan internal SO disimpan dan diaudit hanya di Intranet; tidak dimasukkan ke payload Accurate. Satu SQ hanya dapat memiliki satu SO aktif di Intranet. Pemilihan SQ serta publikasi SO memeriksa ulang perusahaan, identitas SQ, pelanggan, mata uang, barang, satuan dan jumlah yang tersedia.

Milestone SQ pertama: [whitelist Portal, API WMS, katalog dan approval Super Admin](docs/sq-milestone-one.md).
