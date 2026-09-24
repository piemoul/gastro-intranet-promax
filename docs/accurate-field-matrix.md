# Matriks field Accurate — hasil pembacaan 24 September 2026

Periode transaksi: 26/06/2026–24/09/2026. Angka `x/n` berarti jumlah **dokumen sampel** yang terisi/memakai fitur itu, bukan proporsi seluruh transaksi. Nilai nol atau false tidak dihitung sebagai penggunaan aktif. `—` berarti tidak ada sampel. Ini observasi pengisian, bukan penetapan field wajib bisnis.

## PO, SQ, SO per perusahaan

### Gastro Gizi Sarana (GGS)

| Field/perilaku | Sumber | PO | SQ | SO |
|---|---|---:|---:|---:|
| Nomor/tanggal/relasi | `number + transDate + customer/vendor` | 10/10 | 3/3 | 10/10 |
| Cabang ID | `branchId` | 10/10 | 3/3 | 10/10 |
| Mata uang | `currency.code` | 10/10 | 3/3 | 10/10 |
| Kurs | `rate` | 10/10 | 3/3 | 10/10 |
| Termin | `paymentTerm.name` | 10/10 | 3/3 | 10/10 |
| Tanggal kirim | `shipDate` | 10/10 | 0/3 | 10/10 |
| Alamat kirim | `toAddress` | 10/10 | 0/3 | 10/10 |
| Catatan | `description` | 10/10 | 1/3 | 10/10 |
| PO pelanggan | `poNumber` | 0/10 | 0/3 | 10/10 |
| Kena pajak | `taxable=true` | 6/10 | 3/3 | 7/10 |
| Harga termasuk pajak | `inclusiveTax=true` | 0/10 | 0/3 | 0/10 |
| Diskon dokumen | `cashDiscPercent/cashDiscount` | 0/10 | 0/3 | 0/10 |
| Ekspedisi | `shipment.name` | 0/10 | 0/3 | 0/10 |
| FOB | `fob.name` | 0/10 | 0/3 | 0/10 |
| Custom teks header | `charField1..10` | 0/10 | 0/3 | 0/10 |
| Custom angka header nonzero | `numericField1..10` | 0/10 | 0/3 | 0/10 |
| Custom tanggal header | `dateField1..2` | 0/10 | 0/3 | 0/10 |
| Gudang pada setidaknya satu baris | `detailItem.warehouse` | 4/10 | 0/3 | 0/10 |
| Sales pada setidaknya satu baris | `detailItem.salesmanList` | 0/10 | 3/3 | 10/10 |
| Diskon baris | `itemDiscPercent/itemCashDiscount` | 0/10 | 0/3 | 0/10 |
| Proyek baris | `detailItem.project` | 1/10 | 0/3 | 7/10 |
| Departemen baris | `detailItem.department` | 0/10 | 0/3 | 3/10 |
| Custom teks baris | `detailItem.charField1..15` | 0/10 | 0/3 | 2/10 |
| ID SQ pada baris (termasuk SQ sendiri) | `detailItem.salesQuotationId` | 0/10 | 3/3 | 0/10 |
| SKU berulang dalam dokumen | `detailItem.itemId` | 3/10 | 0/3 | 0/10 |

| Variasi | PO | SQ | SO |
|---|---|---|---|
| Mata uang | IDR: 10 | IDR: 3 | IDR: 10 |
| Tarif pajak1 tersimpan | 11: 6, 0: 4 | 11: 3 | 0: 3, 11: 7 |
| Persentase dasar pajak | 100: 10 | 100: 3 | 100: 10 |
| Termin | net 30: 3, net 7: 3, C.O.D: 3, net 15: 1 | C.O.D: 3 | net 30: 3, C.O.D: 7 |

### Resto Sarana Prima (RSP)

| Field/perilaku | Sumber | PO | SQ | SO |
|---|---|---:|---:|---:|
| Nomor/tanggal/relasi | `number + transDate + customer/vendor` | 10/10 | — | 10/10 |
| Cabang ID | `branchId` | 10/10 | — | 10/10 |
| Mata uang | `currency.code` | 10/10 | — | 10/10 |
| Kurs | `rate` | 10/10 | — | 10/10 |
| Termin | `paymentTerm.name` | 10/10 | — | 10/10 |
| Tanggal kirim | `shipDate` | 10/10 | — | 10/10 |
| Alamat kirim | `toAddress` | 10/10 | — | 10/10 |
| Catatan | `description` | 10/10 | — | 10/10 |
| PO pelanggan | `poNumber` | 0/10 | — | 10/10 |
| Kena pajak | `taxable=true` | 1/10 | — | 10/10 |
| Harga termasuk pajak | `inclusiveTax=true` | 0/10 | — | 0/10 |
| Diskon dokumen | `cashDiscPercent/cashDiscount` | 0/10 | — | 0/10 |
| Ekspedisi | `shipment.name` | 0/10 | — | 0/10 |
| FOB | `fob.name` | 0/10 | — | 0/10 |
| Custom teks header | `charField1..10` | 0/10 | — | 0/10 |
| Custom angka header nonzero | `numericField1..10` | 0/10 | — | 0/10 |
| Custom tanggal header | `dateField1..2` | 0/10 | — | 0/10 |
| Gudang pada setidaknya satu baris | `detailItem.warehouse` | 9/10 | — | 0/10 |
| Sales pada setidaknya satu baris | `detailItem.salesmanList` | 0/10 | — | 10/10 |
| Diskon baris | `itemDiscPercent/itemCashDiscount` | 0/10 | — | 0/10 |
| Proyek baris | `detailItem.project` | 0/10 | — | 0/10 |
| Departemen baris | `detailItem.department` | 0/10 | — | 0/10 |
| Custom teks baris | `detailItem.charField1..15` | 0/10 | — | 0/10 |
| ID SQ pada baris (termasuk SQ sendiri) | `detailItem.salesQuotationId` | 0/10 | — | 0/10 |
| SKU berulang dalam dokumen | `detailItem.itemId` | 0/10 | — | 0/10 |

| Variasi | PO | SQ | SO |
|---|---|---|---|
| Mata uang | USD: 6, EUR: 3, IDR: 1 | — | IDR: 9, USD: 1 |
| Tarif pajak1 tersimpan | 0: 9, 12: 1 | — | 12: 10 |
| Persentase dasar pajak | 100: 7, 91.666667: 3 | — | 91.666667: 10 |
| Termin | C.O.D: 9, net 30: 1 | — | C.O.D: 4, net 30: 6 |

### Sarana Refrigeratama (SR)

| Field/perilaku | Sumber | PO | SQ | SO |
|---|---|---:|---:|---:|
| Nomor/tanggal/relasi | `number + transDate + customer/vendor` | 10/10 | 10/10 | 10/10 |
| Cabang ID | `branchId` | 10/10 | 10/10 | 10/10 |
| Mata uang | `currency.code` | 10/10 | 10/10 | 10/10 |
| Kurs | `rate` | 10/10 | 10/10 | 10/10 |
| Termin | `paymentTerm.name` | 10/10 | 10/10 | 10/10 |
| Tanggal kirim | `shipDate` | 10/10 | 0/10 | 10/10 |
| Alamat kirim | `toAddress` | 10/10 | 10/10 | 10/10 |
| Catatan | `description` | 10/10 | 10/10 | 10/10 |
| PO pelanggan | `poNumber` | 0/10 | 0/10 | 10/10 |
| Kena pajak | `taxable=true` | 9/10 | 10/10 | 10/10 |
| Harga termasuk pajak | `inclusiveTax=true` | 0/10 | 0/10 | 0/10 |
| Diskon dokumen | `cashDiscPercent/cashDiscount` | 0/10 | 0/10 | 0/10 |
| Ekspedisi | `shipment.name` | 0/10 | 0/10 | 0/10 |
| FOB | `fob.name` | 0/10 | 0/10 | 0/10 |
| Custom teks header | `charField1..10` | 0/10 | 0/10 | 0/10 |
| Custom angka header nonzero | `numericField1..10` | 0/10 | 0/10 | 0/10 |
| Custom tanggal header | `dateField1..2` | 0/10 | 0/10 | 0/10 |
| Gudang pada setidaknya satu baris | `detailItem.warehouse` | 0/10 | 0/10 | 0/10 |
| Sales pada setidaknya satu baris | `detailItem.salesmanList` | 0/10 | 8/10 | 10/10 |
| Diskon baris | `itemDiscPercent/itemCashDiscount` | 0/10 | 3/10 | 1/10 |
| Proyek baris | `detailItem.project` | 0/10 | 0/10 | 0/10 |
| Departemen baris | `detailItem.department` | 0/10 | 0/10 | 0/10 |
| Custom teks baris | `detailItem.charField1..15` | 0/10 | 0/10 | 0/10 |
| ID SQ pada baris (termasuk SQ sendiri) | `detailItem.salesQuotationId` | 0/10 | 10/10 | 7/10 |
| SKU berulang dalam dokumen | `detailItem.itemId` | 1/10 | 0/10 | 2/10 |

| Variasi | PO | SQ | SO |
|---|---|---|---|
| Mata uang | IDR: 10 | IDR: 10 | IDR: 10 |
| Tarif pajak1 tersimpan | 0: 1, 12: 9 | 12: 10 | 12: 10 |
| Persentase dasar pajak | 91.666667: 10 | 91.666667: 10 | 91.666667: 10 |
| Termin | net 30: 10 | C.O.D: 10 | C.O.D: 10 |

## Master barang

Sampel 10 ID master terbesar per PT; bukan pemilihan acak dan bukan sepuluh barang paling sering dipakai.

| Field/perilaku | Sumber | GGS | RSP | SR |
|---|---|---:|---:|---:|
| Kode/nama | `no/name` | 10/10 | 10/10 | 10/10 |
| Tipe | `itemType` | 10/10 | 10/10 | 10/10 |
| Kategori | `itemCategory.name` | 10/10 | 10/10 | 10/10 |
| Satuan utama | `unit1.name` | 10/10 | 10/10 | 10/10 |
| Merek | `itemBrand.name` | 10/10 | 10/10 | 9/10 |
| Model | `charField1` | 10/10 | 10/10 | 9/10 |
| Satuan tambahan | `unit2..5` | 0/10 | 0/10 | 0/10 |
| Pengelolaan SN aktif | `manageSN=true` | 0/10 | 0/10 | 0/10 |
| Barang nonaktif | `suspended=true` | 0/10 | 0/10 | 0/10 |
| Harga jual utama >0 | `unitPrice` | 0/10 | 0/10 | 0/10 |
| Biaya master >0 | `cost` | 0/10 | 0/10 | 0/10 |
| Pajak utama | `tax1` | 10/10 | 10/10 | 10/10 |
| Akun persediaan | `inventoryGlAccount` | 10/10 | 10/10 | 10/10 |
| Akun penjualan | `salesGlAccount` | 10/10 | 10/10 | 10/10 |
| Catatan | `notes` | 0/10 | 0/10 | 0/10 |

| Variasi | GGS | RSP | SR |
|---|---|---|---|
| Tipe | INVENTORY: 10 | INVENTORY: 10 | NON_INVENTORY: 1, INVENTORY: 9 |
| Satuan | UNIT: 2, PCS: 8 | PCS: 10 | PCS: 10 |
| Kategori | LOCAL PRODUCT (NON PABRIKASI): 2, IMPOR - PART: 8 | IMPOR - PART: 10 | General: 1, IMPOR - PART: 9 |

`serialNumberType=UNIQUE` ditemukan ketika `manageSN=false`. Jangan menafsirkan tipe serial saja sebagai bukti barang wajib SN. Semua sampel memiliki harga utama nol; jangan menggunakan nol itu untuk menyimpulkan harga transaksi gratis atau menghapus input harga. Kategori dapat membawa akun bawaan. Batasan edit barang yang sudah bertransaksi belum diuji karena tidak ada penulisan Accurate.

## Master klien (tambahan permintaan pengguna)

Tiga ID klien terbesar per PT; hanya untuk memastikan pemetaan detail dan proposal lokal kepala sales.

| Field | GGS | RSP | SR |
|---|---:|---:|---:|
| Nama/kode | 3/3 | 3/3 | 3/3 |
| Email | 1/3 | 0/3 | 0/3 |
| Telepon kerja | 1/3 | 0/3 | 0/3 |
| Telepon seluler | 1/3 | 0/3 | 0/3 |
| Alamat tagihan | 3/3 | 3/3 | 3/3 |
| NPWP | 0/3 | 0/3 | 0/3 |
| Termin | 3/3 | 3/3 | 3/3 |
| Mata uang | 3/3 | 3/3 | 3/3 |
| Catatan | 0/3 | 0/3 | 0/3 |

Termin klien dibaca dari `term`, berbeda dengan header transaksi `paymentTerm`. Identitas pajak, email, telepon dan alamat tidak dicetak dalam laporan ini.

## Wajib API, wajib bisnis, dan default

Sumber metadata: salinan resmi Accurate API tanggal 3 Juli 2026 dari `https://account.accurate.id/developer/api-docs.do`, versi Accurate API `1.0.1#4533`, tersedia di proyek WMS. Akses web publik ke dokumentasi terkini tidak berhasil; label required di bawah belum diverifikasi dengan operasi save dan tidak otomatis membuktikan semua constraint runtime.

| Objek | Ditandai required pada metadata save | Perlakuan tahap ini |
|---|---|---|
| PO | `vendorNo`; baris: `itemNo`, `unitPrice` | Tanggal, relasi, barang, satuan, jumlah dan harga wajib draft Intranet sebagai kebijakan aplikasi; tidak diklaim semuanya wajib API. |
| SQ | `customerNo`, `detailItem`; baris: `itemNo`, `unitPrice` | SQ lokal dan review; tidak diterbitkan ke Accurate. |
| SO | `customerNo`, `detailExpense`, `detailItem`; baris: `itemNo`, `unitPrice` | `detailExpense` required di metadata tetapi kosong di seluruh sampel; perlakukan sebagai ketidakpastian dokumentasi, jangan membuat biaya palsu. |
| Barang | `itemCategoryName`, `itemType`, `name`, `unit1Name` | Kode barang tetap wajib pada proposal aplikasi demi identitas; kategori/tipe/satuan perlu pilihan master saat penulisan kelak diaktifkan. |
| Klien | `name`, `transDate` | Simpan proposal lokal. `transDate` adalah tanggal pengakuan menurut metadata; belum diuji terhadap API save. |

Belum ada field yang dapat dinyatakan **wajib bisnis per PT** hanya dari sampel ini. Input bersyarat: kurs untuk transaksi valuta asing; pajak/DPP mengikuti konfigurasi transaksi; gudang/satuan mengikuti baris dan proses WMS; brand/model mengikuti barang; proyek/departemen/custom mengikuti transaksi yang memakainya. Nilai default form adalah usulan aplikasi, bukan aturan perusahaan yang terbukti.

Sumber pilihan transaksi selalu master Accurate milik PT aktif. Jangan menyamakan ID item, customer/vendor, cabang, satuan, gudang, kategori, pajak atau akun antar-PT. Harga, diskon nominal/bertingkat, pajak ganda, biaya tambahan, dan pembulatan memerlukan pelestarian semantik sebelum dapat dikirim ke Accurate.
