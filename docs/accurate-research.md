# Audit Accurate read-only — 24 September 2026

## Metode dan batas pembacaan

- Pembacaan produksi memakai token WMS terpisah per PT dan signature HMAC di server. Tidak memakai lingkungan uji Accurate. Seluruh permintaan menggunakan GET pada allowlist `list.do`/`detail.do`; tidak ada create, save, edit, close, approval atau delete Accurate.
- Rentang transaksi utama 26/06/2026–24/09/2026; maksimum 10 dokumen terbaru per jenis/PT, sort tanggal lalu ID menurun. Detail barang dibatasi 10 ID terbesar/PT, klien 3 ID terbesar/PT. Tidak mengambil seluruh katalog atau SN/stok gudang.
- 112 detail dibaca melalui 15 daftar utama; satu pembacaan tambahan khusus SQ RSP memperluas rentang ke 24 September 2025–24 September 2026 karena rentang utama kosong. Hasil perluasan tetap 0. Total riset 128 GET, di luar smoke test integrasi yang juga GET.
- Sampel mentah disimpan privat pada `.data/research/accurate-sample.json` (gitignored, direktori mode 0700, file 0600); tidak memuat header kredensial. Laporan hanya berisi agregat dan contoh nomor/tanggal, tanpa alamat, identitas pajak, token atau harga individual.
- `npm run research`/skrip riset harus dijalankan hanya oleh operator server. Itu membaca data produksi secara terbatas dan tidak mengekspor mutasi.

## Cakupan yang terbaca

| PT | PO sampel / total 90 hari | SQ sampel / total 90 hari | SO sampel / total 90 hari | Barang sampel / seluruh master | Klien sampel / seluruh master |
|---|---:|---:|---:|---:|---:|
| Gastro Gizi Sarana (GGS) | 10 / 405 | 3 / 3 | 10 / 496 | 10 / 4667 | 3 / 2001 |
| Resto Sarana Prima (RSP) | 10 / 10 | 0 / 0 | 10 / 172 | 10 / 705 | 3 / 363 |
| Sarana Refrigeratama (SR) | 10 / 53 | 10 / 854 | 10 / 860 | 10 / 2132 | 3 / 898 |

| PT / jenis | Contoh nomor sumber | Tanggal |
|---|---|---|
| 1 / PO | `PAB-26/1017` | 24/09/2026 |
| 1 / SQ | `SQ.2026.07.00001` | 04/07/2026 |
| 1 / SO | `BALI-26/113` | 24/09/2026 |
| 2 / PO | `011-RC-PART-2026` | 18/09/2026 |
| 2 / SO | `SO26-09-00348` | 24/09/2026 |
| 3 / PO | `PO/SR/BT/26/008` | 23/09/2026 |
| 3 / SQ | `SQ.2026.09.00215` | 24/09/2026 |
| 3 / SO | `SO/SR/26/09/1719` | 24/09/2026 |

## Temuan yang memengaruhi desain

- **GGS:** sepuluh PO dan sepuluh SO terbaru memakai IDR; sampel memuat transaksi kena pajak dan tidak kena pajak. Pajak1 tersimpan 11 dengan DPP 100 pada transaksi kena pajak. SQ hanya tiga dalam periode, sehingga bukan dasar yang kuat untuk meniru seluruh proses persetujuan historis.
- **RSP:** PO sampel terdiri dari USD 6, EUR 3, IDR 1; SO terdiri dari IDR 9 dan USD 1. Form tidak boleh mengunci rupiah atau kurs satu. Tidak ditemukan SQ dalam 365 hari, sehingga alur SQ baru merupakan kebutuhan pengguna, bukan kebiasaan Accurate yang telah terbukti pada PT ini.
- **Sarana:** SQ sering dipakai menurut jumlah populasi yang dilaporkan API (854 pada periode utama). Sampel SQ/SO memakai pajak1 12 dengan DPP 91.666667 persen. Angka DPP adalah persen, bukan fraksi; perhitungan harus memakai tarif × DPP/100, dengan pembulatan sebagai estimasi lokal.
- **Barang:** merek berasal dari `itemBrand.name`, model dari `charField1`. Terisi 10/10 GGS, 10/10 RSP, dan 9/10 Sarana. Sampel Sarana juga mencakup satu NON_INVENTORY; jangan memaksakan filter INVENTORY milik gudang pada formulir komersial.
- **Harga dan serial:** semua 30 master terbaru berharga utama nol dan `manageSN=false`; beberapa memiliki `serialNumberType=UNIQUE` sebagai nilai bawaan. Ini tidak membuktikan harga transaksi nol ataupun seluruh katalog tanpa serial. Form menampilkan tipe dan pengelolaan SN secara terpisah.
- **Referensi dokumen:** `processHistory` pada sebagian PO/SO memuat RI/PI/DO/SI. Detail menampilkan referensi itu sebagai informasi parsial; statusnya tidak menyatakan seluruh booking/picklist/invoice/down payment sudah diperiksa. Pembalikan SO Accurate tidak dilakukan.
- **Salinan ke draft:** semua 73 sampel transaksi tidak memicu pemeriksaan semantik diskon nominal/bertingkat, pajak ganda, biaya tambahan atau DPP yang hilang. Transport tetap memberi `sourceWarnings` ketika variasi itu muncul, dan pembuatan salinan harus diblokir agar angka tidak berubah diam-diam.
- **Klien:** detail klien memiliki `term` untuk termin, `currency` untuk mata uang, `bill*` untuk alamat tagihan serta `npwpNo` untuk NPWP. Kepala sales hanya mengelola proposal lokal dalam tahap ini.

Lihat [matriks field per PT](accurate-field-matrix.md) untuk frekuensi pengisian, variasi termin, gudang, diskon, custom fields, proyek/departemen, dan metadata required API.

## Batas kesimpulan dan validasi

- Ini sampel terbaru yang sengaja dibatasi, bukan audit statistik lengkap. Frekuensi terisi tidak menetapkan field wajib. Tiga sampel klien tidak cukup untuk menetapkan kebijakan pajak atau termin per PT. Riwayat edit dan alasan operator mengubah master tidak diteliti; detail akhir saja tidak dapat membuktikan kebiasaan pengeditan.
- Kemampuan penulisan dan batasan edit master bertransaksi tidak diuji. Salinan dokumentasi API lama dipakai sebagai sumber struktur; dokumentasi terkini belum dapat dibaca lewat akses web publik. Tidak ada klaim bahwa SQ→SO atau SO→SQ didukung oleh satu endpoint status.
- Smoke test read-only berhasil untuk daftar PO/SQ/SO, barang, klien di ketiga PT dan vendor GGS. Uji lokal transport membuktikan metode GET eksplisit, penolakan endpoint write/ID PT tidak valid, host HTTPS Accurate, larangan redirect, signature WIB, serta penyamaran error.
- Uji normalisasi membuktikan pelestarian ID baris/deskripsi sumber, tarif pajak dan DPP, peringatan variasi perhitungan yang belum didukung, referensi proses parsial, serta pemisahan serialType dari manageSN. Mock hanya berada di proses unit test lokal; tidak ada database Accurate uji maupun transaksi percobaan.
- Pembatasan laju proses: antrean 350 ms antarpermintaan, timeout 20 detik, maksimal satu pengulangan khusus respons HTTP 429. Aplikasi tidak mencoba memperbarui kredensial lewat OAuth POST karena tahap ini sepenuhnya read-only.
