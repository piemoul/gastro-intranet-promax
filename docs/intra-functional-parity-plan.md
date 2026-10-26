# Rencana dan kontrak kelengkapan Intra

Permintaan 26 Oktober 2026: lengkapi fungsi komersial Intra lama secara surgical, dengan SKU mengacu Accurate Online dan WMS. Manage Items wajib memilih SKU dari salah satu sumber tersebut. Penambahan klien ke Accurate hanya oleh Super Admin. Pengujian tidak boleh membuat data percobaan di Accurate.

## Peta fungsi yang diverifikasi

Computer Use memeriksa menu Administration (Users, Roles, Branches, Settings), Items (Brands, Categories, Items), Sales (Customers, Quotations, Sales Orders), Logs dan Quotation Report. Form Manage Items lama memiliki tier 0–5, beberapa buy price dan cost multiplier, biaya delivery per cabang, instalasi, kategori/series, spesifikasi/dimensi/berat, serta supplier dan lead time. Setting lama berisi kurs. Form customer memiliki alias/group, kategori, default sales, alamat/telepon kantor dan beberapa PIC. SQ memiliki unit/project, bahasa, sales/admin, bundling delivery/installation, pembulatan, special approval, terms dan kurs.

## Implementasi

1. **SKU & Manage Items:** pencarian Accurate/WMS, pilihan identitas canonical Accurate, pemetaan eksplisit WMS bila kode berbeda; metadata komersial tidak membuat SKU baru dan tidak menulis master barang Accurate/WMS.
2. **Pricebook:** enam tier, buy prices, multipliers, biaya cabang/delivery/installation, masa berlaku serta metadata produk. Pengaturan hanya Super Admin; reviewer membaca/menggunakan harga. Semua perubahan memakai versi dan audit.
3. **Settings:** kurs eksplisit per PT, template terms ID/EN, cabang/default, kategori/series dan pengaturan penawaran. Tidak mengarang kurs pasar atau menyalin PPN lama sebagai tarif aktif.
4. **SQ lengkap:** aplikasi harga dari pricebook tervalidasi di server, konversi ke satu mata uang dokumen, opsi bundling dan pembulatan, analisis biaya/margin untuk reviewer, alasan pengecualian di bawah tier dasar, duplikasi/revisi lokal, status tindak lanjut, laporan/export dan cetak penawaran. Approval/publikasi tetap hanya Super Admin dan versi yang berubah membatalkan approval.
5. **Klien baru:** draft khusus Super Admin, alamat terstruktur dan beberapa PIC. Penerbitan create-only `customer/save.do`, tanpa ID/update/saldo awal, dengan reservasi durable, cek duplikasi, satu pengiriman dan verifikasi baca. Hasil tidak pasti dikunci untuk rekonsiliasi; tidak ada retry otomatis.
6. **Direktori/reference:** klien/supplier dan cabang/mata uang/termin dibaca dari Accurate per PT; identitas sales tetap berasal dari Gastro Portal. Dashboard menyediakan pencarian SKU WMS/Accurate.
7. **Verifikasi:** uji otorisasi/PT, OCC/audit, pemetaan salah, harga/kurs/pembulatan, akses biaya, revisi, cetak, publikasi klien mocked dan kondisi tidak pasti. Build Docker, browser QA, pemeriksaan credential dan Graphify dilakukan setelah implementasi.

## Batas dan aturan data

- Intranet menulis hanya data miliknya; shared Neon memakai tabel `intranet_`. Project/tabel WMS tetap utuh; API baca WMS mempertahankan transaksi READ ONLY.
- Canonical SKU adalah ID/kode Accurate dari PT aktif, bukan teks bebas. Pemetaan WMS menyimpan kedua identitas secara eksplisit, diverifikasi server. Manage Items tidak dapat menyimpan identitas palsu.
- Harga/multiplier dalam Intranet merupakan pricebook lokal. Tarif/identitas master Accurate tidak dimutasi. Biaya internal tidak dikirim ke Accurate dan tidak diberikan pada sales biasa melalui API pricebook/analisis.
- Tier berbasis markup dibedakan dari margin aktual. Kurs wajib eksplisit. Biaya yang tidak dibundel tidak diam-diam menambah total: jika hendak ditagihkan terpisah, gunakan baris SKU jasa Accurate yang sah.
- Dokumen cetak memakai snapshot harga/terms yang disimpan, tanpa data biaya internal. Dokumen hasil revisi/duplikasi adalah draft baru, tidak mengubah SQ Accurate asal.
- Endpoint create klien mengikuti schema OpenAPI resmi `https://account.accurate.id/open-api/json.do` (versi yang diunduh untuk implementasi: 1.5956.5010). Master lama tetap tidak dapat diedit dari Intranet.

## Status pekerjaan

- [x] Graphify, kode dan formulir legacy diperiksa; sumber OpenAPI resmi diunduh sebagai referensi lokal privat.
- [x] SKU & Manage Items, pricebook, settings dan referensi.
- [x] SQ komersial, revisi/duplikasi, cetak dan laporan.
- [x] Pembuatan klien khusus Super Admin dengan publikasi guarded.
- [ ] Tests, deployment, browser QA dan Graphify akhir.

## Cara menggunakan Manage Items

1. Pilih PT aktif lalu **Manage Items**. Cari kode/nama pada tab **Cari SKU Accurate**, atau gunakan pilihan brand/model. SKU dengan brand/model kosong tetap tersedia pada pencarian langsung.
2. Tab **Cari SKU WMS** menampilkan identitas dan stok API WMS. Saat dipilih, server mencari padanan kode Accurate di PT yang sama. Bila berbeda, Super Admin memilih tujuan Accurate dan menyimpan alasan pemetaan; tidak ada master baru yang dibuat.
3. Setelah SKU terpilih, isi parameter lokal. Identitas ID/kode/nama/brand/model/satuan tidak dapat diketik ulang sebagai master baru. Setiap simpan memvalidasi ulang master dan versi parameter.
4. Isi buy price, multiplier, tier yang diperlukan serta kurs pada Settings bila mata uang berbeda. Harga tidak diimpor otomatis dari Intra lama. Perubahan berlaku untuk versi baru, tercatat di audit dan membutuhkan penerapan ulang pada SQ sebelum approval.
5. Pada draft SQ yang sudah disimpan, reviewer memilih baris dan tier, lalu **Terapkan harga Manage Items**. Baris custom tetap diisi/dipetakan admin. Approval SQ dan publikasi tetap hanya Super Admin.

## Pemeriksaan referensi live

GET-only pada 26 Oktober 2026 berhasil membaca cabang, mata uang, termin dan supplier untuk GGS/RSP/SRI. Termin yang diterima masing-masing 8/10/11; tidak ada permintaan tulis dalam pemeriksaan ini. Keberhasilan baca tidak membuktikan scope `customer_save`; izin tulis baru akan diketahui pada penerbitan klien bisnis yang benar-benar diminta pengguna. Tidak ada klien atau transaksi percobaan yang dibuat.
