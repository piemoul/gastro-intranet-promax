# Penerbitan PO / SO Accurate

Per 25 September 2026, pembuatan PO/SO baru pada tahap akhir diizinkan pengguna. Persetujuan internal sendiri tidak mengirim apa pun. Kepala sales membuat SO; kepala importer membuat PO; master admin dapat melakukan keduanya dalam PT aktif. SQ, master barang/klien, dan usulan edit dokumen Accurate tetap lokal.

Alur SO: SQ → persetujuan SQ → SO internal → persetujuan SO → **Buat SO Accurate** → konfirmasi PT, mitra, jumlah baris, estimasi nilai → nomor Accurate.

Alur PO: draft PO → persetujuan PO → **Buat PO Accurate** → konfirmasi → nomor Accurate.

## Penyimpanan dan pemulihan

Draft disimpan menggunakan tabel Intranet yang sudah ada (JSON/JSONB); tidak ada perubahan tabel WMS. Reservasi dan audit ditulis dalam satu transaksi dengan pemeriksaan versi dan kunci baris PostgreSQL / transaksi SQLite. Hanya pemenang reservasi yang memanggil API. Payload disusun dari versi yang dibekukan. Transport create hanya menerima PO/SO, tanpa ID update, nomor manual, penghapusan, atau retry otomatis.

Status PUBLISHING, UNCERTAIN, dan PUBLISHED memblokir semua edit serta perubahan alur. Respons penolakan pasti membolehkan percobaan baru yang disengaja; timeout, respons tidak jelas, atau proses server terhenti tidak membolehkan kirim ulang. Jika hasil belum pasti, cari dokumen di Accurate dan masukkan nomornya pada **Periksa hasil Accurate**. Pemeriksaan hanya membaca PT yang sama dan mencocokkan penanda percobaan dalam catatan, mitra, barang, satuan, harga, jumlah, diskon, mata uang, kurs, dan total. Tidak ada tombol paksa kirim ulang. Jika proses berhenti sebelum POST terkirim, diperlukan investigasi operator; jangan melepas kunci hanya berdasarkan waktu atau pencarian kosong.

## Field dan batas saat ini

- Header: pelanggan/supplier, tanggal, mata uang, kurs, diskon, termasuk pajak, cabang, termin, tanggal kirim, alamat dan catatan. Referensi SO menjadi `poNumber`; referensi PO ditambahkan dengan label dalam catatan. Penomoran mengikuti default Accurate. Catatan ditambah penanda unik Intranet untuk pemulihan.
- Baris: kode barang, nama, satuan, kuantitas, harga, diskon, gudang, catatan, kode proyek, departemen, serta `dataClassification1Name` hingga `dataClassification10Name`. Salesperson SO menggunakan **nomor identitas**, bukan nama.
- Pajak pertama harus sesuai tarif master barang. Pajak kedua/ketiga dimatikan karena form tidak mewakilinya. Persentase DPP selain 100% pada baris kena pajak belum didukung mapper; API save terdokumentasi tidak menyediakan override DPP. Dokumen tersebut harus diproses langsung di Accurate, bukan mengubah DPP untuk meloloskan validasi. Hasil total dibaca kembali, dan perbedaan di luar toleransi pembulatan mengunci verifikasi.
- Custom field header dan custom field baris selain klasifikasi di atas diblokir sebelum POST jika diisi; tidak dibuang diam-diam. Baris bersumber dari dokumen Accurate juga diblokir dari penerbitan ulang.
- Token setiap PT harus memiliki `sales_order_save` / `purchase_order_save` sesuai penggunaan. Kredensial tetap di server. Tidak ada penambahan izin otomatis.

Mapping mengacu pada salinan resmi dokumentasi Accurate API `1.0.1#4533` tanggal 3 Juli 2026 di proyek WMS serta [panduan API resmi](https://accurate.id/api-integration/api-example/). Halaman dokumentasi endpoint terkini memerlukan login. Koneksi live tetap hanya digunakan untuk pembacaan selama pengembangan; pengujian save menggunakan fixture, tanpa membuat dokumen percobaan di Accurate.
