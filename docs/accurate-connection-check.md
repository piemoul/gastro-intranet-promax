# Pemeriksaan koneksi Accurate tiga PT

Tanggal pemeriksaan: **18 Oktober 2026**. Target: `https://intranet.davay.space`, melalui sesi Google yang sudah login sebagai master admin `malesmikirbos@gmail.com`.

## Hasil

Seluruh koneksi berhasil membaca daftar dan sampel detail. Tabel berikut berisi **total yang dilaporkan API Accurate**, tanpa filter pencarian; pemeriksaan mengambil halaman pertama, bukan menyalin seluruh master/transaksi.

| PT | Barang | Klien | PO | SQ | SO |
| --- | ---: | ---: | ---: | ---: | ---: |
| Gastro Gizi Sarana (GGS) | 4.779 | 2.019 | 1.560 | 3 | 1.749 |
| Resto Sarana Prima (RSP) | 758 | 371 | 79 | 0 | 1.201 |
| Sarana Refrigeratama (SRI) | 2.252 | 933 | 175 | 2.393 | 2.702 |

SQ RSP mengembalikan daftar kosong secara normal. Antarmuka menampilkan “Tidak ada dokumen ditemukan”; tidak ada dokumen SQ yang dibuat untuk mengisi atau menguji daftar tersebut.

## Cakupan verifikasi

- Sesi login mengonfirmasi role `master_admin`, akses ketiga PT, dan konfigurasi koneksi masing-masing.
- PT dipilih melalui dropdown aplikasi. Endpoint data mengambil PT dari sesi server; identitas PT pada delapan sampel detail transaksi sesuai dengan perusahaan aktif.
- **15 pembacaan daftar** berhasil: barang, klien, PO, SQ, dan SO untuk setiap PT. Masing-masing memuat hingga 20 baris; SQ GGS memuat 3 baris, SQ RSP kosong.
- **14 pembacaan detail** berhasil: satu barang, satu klien, dan satu dokumen dari setiap jenis yang memiliki data untuk masing-masing PT. ID detail cocok dengan ID yang dipilih dari daftar; seluruh sampel transaksi memuat baris barang.
- **15 tampilan antarmuka** terverifikasi: Master Barang, Master Klien, serta tab Dokumen Accurate pada PO/SQ/SO di ketiga PT. Baris data tampil pada perusahaan yang sesuai; kondisi SQ RSP kosong juga tampil dengan benar.
- Pada PT awal GGS, jumlah draft lokal dan audit bisnis sebelum/sesudah tetap **0 / 0**.

## Batas operasi

Seluruh panggilan ke Accurate memakai endpoint GET allowlist `item/list.do`, `item/detail.do`, `customer/list.do`, `customer/detail.do`, serta list/detail `purchase-order`, `sales-quotation`, dan `sales-order`. Tidak ada endpoint save/delete/approve yang dipanggil. Pergantian perusahaan hanya mengubah PT aktif pada sesi Intranet.

Tidak ada transaksi percobaan, draft bisnis baru, usulan perubahan master, atau publikasi yang dibuat. Kredensial, identitas klien, nilai transaksi, serta payload lengkap tidak disalin ke laporan ini. Pemeriksaan ini membuktikan keterbacaan daftar dan sampel detail saat pengujian; bukan audit seluruh isi Accurate.
