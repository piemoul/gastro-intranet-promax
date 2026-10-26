# Milestone SQ pertama

Perluasan 26 Oktober 2026 tersedia pada [peta fungsi komersial](intra-functional-parity-plan.md): pilihan SKU sumber di Manage Items, pemetaan WMS → Accurate, pricebook/settings, analisis/laporan/cetak, dan klien baru khusus Super Admin. Ketentuan di bawah menjelaskan milestone pertama; kode WMS berbeda kini dapat dipetakan secara eksplisit oleh Super Admin.

Alur: sales memilih klien Accurate, katalog WMS dan jumlah → simpan draft → ajukan review admin → admin sales/Super Admin mengisi harga, pajak, gudang serta ketentuan → ajukan persetujuan → Super Admin menyetujui → Super Admin mengonfirmasi pembuatan SQ Accurate. Approval tidak otomatis mengirim transaksi.

## Identitas dan hak akses

Gastro Portal menyediakan `GET /api/integrations/intranet?resource=directory`, dilindungi bearer key khusus. Sumber kelayakan adalah snapshot Baserow lengkap dengan pemeriksaan jumlah/duplikasi dari Portal. Intranet hanya menerima ID baris, nama, email resmi, perusahaan, departemen dan status aktif; data pribadi, password, foto serta biometrik tidak diekspor.

Sales aktif harus berada di departemen `SALES & MARKETING` yang dinormalisasi. PT awal mengikuti perusahaan direktori: GGS = 1, RSP = 2, SR/SRI = 3. Perusahaan di luar ketiganya tidak mendapat akses otomatis. Ini bukan pemberian akses lintas PT kepada semua pegawai. Nomor salesperson Accurate tetap diisi admin menggunakan nomor master Accurate, bukan menebak dari nama pegawai.

Super Admin ditetapkan melalui pasangan ID Baserow dan email resmi yang diverifikasi: Dondy (5), Rendy/Randy (30), Yogi (38). Ketiganya dapat mengakses tiga PT. `ROLE=ADMIN` di Portal tidak memberi hak admin Intranet. Akun developer yang sudah dilindungi tetap dipertahankan. Whitelist admin sales belum ditambahkan; peran `head_sales` yang sudah ada berfungsi sebagai reviewer harga, bukan pemberi approval SQ.

Sinkronisasi terjadi saat login serta verifikasi sesi akun Portal, dengan batas cache 60 detik. Perubahan status/PT/peran membatalkan sesi lama dan dicatat di audit identitas. Kegagalan snapshot tidak mengubah whitelist; akses akun Portal ditolak sementara jika sumber tidak dapat diverifikasi setelah cache habis. Pergantian email pada ID yang sama menonaktifkan akun lama tanpa memindahkan ikatan Google. Akun manual tidak diadopsi otomatis. Saat integrasi aktif, akun sales harus berasal dari Portal. Super Admin dapat menjalankan **Pengguna → Sinkronkan Portal**.

## Katalog, stok dan custom

Intranet memanggil API WMS baca terpisah pada jaringan Compose (`wms-read-api:3110/v1/catalog`), menggunakan key khusus server. Layanan ini disimpan di repository Intranet supaya checkout dan container WMS live tidak diubah. Database sumber sama dengan WMS; setiap query berjalan dalam transaksi PostgreSQL `READ ONLY`, berparameter tetap dan dibatasi PT. Tidak ada endpoint tulis, cookie bersama, reservasi SQ atau mutasi tabel WMS.

Brand/model/SKU berasal dari `item_catalog` PT aktif. Stok dihitung dari barang `in_stock`, belum dibatalkan dan `status_outbound=none`, dikurangi booking WMS per gudang dan kelompok serial/nonserial, lalu dibatasi minimum nol. Gudang harus aktif untuk PT tersebut. Stok merupakan informasi saat dibaca, bukan janji/reservasi barang. Pencarian, pemilihan PT, filter dan tombol **Perbarui stok** membaca kembali API. Tidak ada klaim push/webhook atau jaminan stok tetap selama penyusunan SQ.

Portal juga menyediakan index katalog Gastro untuk mengecualikan custom/arsip, serta detail/gambar produk yang cocok secara tepat berdasarkan brand dan model. Padanan ambigu tidak ditebak. Barang WMS tanpa padanan katalog tetap dapat dipilih dengan identitas WMS; gambar/detail ditampilkan bila tersedia. Kode WMS harus cocok dengan master Accurate di PT aktif. Jika tidak cocok, pemilihan ditolak dengan pesan pemetaan, tanpa membuat master baru.

Barang custom dapat ditulis manual sebagai permintaan lokal dengan ID Accurate kosong. Admin harus memetakannya ke SKU Accurate yang sudah ada sebelum approval. Intranet tidak membuat atau mengubah master Accurate. Sales tidak dapat mengirim harga, diskon, pajak, ketentuan komersial atau flag review melalui request palsu. Perubahan draft selalu memakai versi, audit, dan membatalkan approval. Perubahan sales juga membatalkan review harga.

## Publikasi

SQ memerlukan review komersial, data lengkap, status APPROVED, identitas approver dan penanda kebijakan `SQ_SUPER_ADMIN_V1`. Approval lama dari kebijakan sebelumnya tidak cukup. Hanya Super Admin dapat melakukan approval dan publikasi SQ. Pemeriksaan ini berlaku pada API, workflow dan reservasi durable kedua backend SQLite/PostgreSQL.

Layanan publikasi yang sudah ada menyimpan reservasi dan audit sebelum POST Accurate, lalu mengirim satu kali tanpa ID/update/nomor manual/retry otomatis. Hasil tidak pasti tetap terkunci untuk rekonsiliasi baca. Catatan internal tidak dikirim. Perihal, PIC, validitas, pengiriman, instalasi, garansi dan franco dimasukkan sebagai keterangan berlabel pada SQ. SO/PO tidak diperluas pada milestone ini.

## Konfigurasi dan operasi

- Intranet `.env.local`: `INTRANET_PORTAL_API_URL`, `INTRANET_PORTAL_API_KEY`, `INTRANET_WMS_API_URL`, `INTRANET_WMS_API_KEY`; OAuth dan key Accurate tetap tersendiri.
- Gastro Web `.env.local`: tambahan `INTRANET_PORTAL_API_KEY` yang sama, tanpa mengganti konfigurasi Portal lainnya. Source endpoint berada di `C:/ai/CLAWD/GASTRO/Web/app/api/integrations/intranet/route.ts`; perubahan ini harus disertakan saat rilis project Web berikutnya.
- Intranet `.env.wms-read.local`: `WMS_READ_DATABASE_URL` dan `WMS_READ_API_KEY`. File ini khusus layanan baca dan tidak dimount ke aplikasi. Nilainya tidak disimpan di Git/image/log.
- Jalankan `docker compose up -d --build wms-read-api app`. Pertahankan volume data Intranet. Build/restart Portal diperlukan setelah menambah route/key; WMS live tidak perlu di-restart.

Pengujian memakai database terisolasi dan mock semua write Accurate. Verifikasi live dibatasi pembacaan direktori, katalog, stok, master dan koneksi Accurate. Tidak membuat transaksi percobaan.
