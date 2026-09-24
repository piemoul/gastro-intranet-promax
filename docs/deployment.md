# Deployment Intranet

## Penyimpanan produksi dan pemisahan WMS

Vercel menggunakan PostgreSQL melalui `DATABASE_URL`. Sesuai keputusan pengguna, URL boleh menunjuk **database Neon yang sudah dipakai WMS**, tetapi Intranet hanya membaca/menulis objek miliknya sendiri dengan awalan `intranet_`. Aplikasi tidak mengimpor store atau menjalankan migrasi milik WMS.

Objek data Intranet:

- `intranet_users`, `intranet_sessions`, `intranet_oauth_flows`, `intranet_user_audit` untuk whitelist, sesi Google dan audit akses.
- `intranet_drafts`, `intranet_draft_sequences`, `intranet_create_requests`, `intranet_draft_audit` untuk draft, persetujuan, penomoran, idempotensi dan audit bisnis.
- `intranet_schema_migrations` untuk versi migrasi. Index, sequence, trigger dan fungsi Intranet juga memakai awalan `intranet_`.

Migrasi berjalan secara malas saat store pertama kali dipakai, dalam transaksi dan advisory lock bernama `gastro-intranet:schema`. Versi migrasi yang berhasil disimpan di database, sehingga beberapa instance Vercel tidak membuat schema bersamaan. Migrasi gagal dibatalkan dan dapat dicoba ulang. `PgDraftStore.ready()` dan `PgUserStore.ready()` juga dapat dipanggil operator untuk menyiapkan tabel sebelum trafik masuk.

Store PostgreSQL memakai maksimal lima koneksi per proses, `prepare:false` untuk kompatibilitas pooler, TLS dengan verifikasi sertifikat untuk host nonlokal, timeout koneksi 15 detik, serta pelepasan koneksi idle setelah 20 detik. Gunakan URL pooled untuk runtime Vercel. Seluruh callsite store harus memakai `await`, walaupun implementasi SQLite lokal masih sinkron.

`DATABASE_URL` yang tidak tersedia menyebabkan aplikasi Vercel menolak mulai menggunakan store; tidak ada fallback ke SQLite sementara. SQLite hanya dipakai untuk pengembangan lokal saat `DATABASE_URL` tidak diatur. Data `.data` lokal tidak otomatis dimigrasikan atau diunggah ke Neon.

## Konfigurasi rahasia

Simpan variabel berikut hanya pada konfigurasi server/Vercel atau `.env.local` yang diabaikan Git:

| Variabel | Fungsi |
|---|---|
| `DATABASE_URL` | URL Neon pooled untuk tabel Intranet. |
| `APP_URL` | Origin HTTPS kanonis aplikasi; menentukan callback Google dan pemeriksaan origin. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Konfigurasi OAuth Google. Callback terdaftar harus sama persis dengan `APP_URL` + `/api/auth/google/callback`. |
| `ACCURATE_HOST` | Host HTTPS Accurate; tidak mengandung path tambahan. |
| `ACCURATE_SIGNATURE_KEY` | Kunci signature Accurate, hanya pada server. |
| `ACCURATE_API_TOKEN`, `ACCURATE_API_TOKEN_RSP`, `ACCURATE_API_TOKEN_SARANA` | Token baca ketiga PT. |

`INTRANET_WMS_ENV_FILE` dapat digunakan pada mesin lokal untuk mengambil hanya variabel Accurate yang dibutuhkan dari file WMS; path lokal itu tidak tersedia di Vercel. Konfigurasi produksi harus menerima variabel server yang sesuai secara langsung. Jangan unggah `.env`, `.data`, hasil riset mentah, token atau kredensial ke GitHub maupun artifact CI.

## CI/CD

Workflow GitHub menjalankan dependency install dari lockfile, lint, typecheck, pengujian dan build. Deployment produksi hanya boleh mengikuti keberhasilan pemeriksaan untuk branch `main`. Token deployment Vercel disimpan pada GitHub Actions secrets; organisasi/project ID pada repository variables. Jangan meletakkan token di YAML atau log.

Pengujian unit dan build tidak membutuhkan kredensial Accurate. Pemeriksaan PostgreSQL dapat diaktifkan dengan `INTRANET_TEST_DATABASE_URL` yang menunjuk layanan PostgreSQL sementara pada CI. Variabel `DATABASE_URL` tetap tidak diisi pada unit/API tests yang menggunakan SQLite.

Untuk verifikasi operator pada Neon, gunakan URL **unpooled** secara eksplisit sebagai `INTRANET_TEST_DATABASE_URL`. Test PostgreSQL membuat schema sementara berawalan `intranet_*_test_`, memeriksa `current_schema()` sebelum menjalankan DDL/data fixture, dan menghapus hanya schema sementara itu setelah selesai. Jangan mengandalkan startup `search_path` pada koneksi pooled tanpa verifikasi: pooler atau parameter URL dapat menimpanya.

Hasil verifikasi 24 September 2026: tujuh pemeriksaan workflow PostgreSQL lulus, termasuk pembacaan lintas koneksi, pembatasan peran/PT, pembuatan berulang bersamaan, konflik versi bersamaan, persetujuan, promosi SQ, pembalikan SO lokal, pelestarian sumber, audit append-only, rollback dan migrasi yang dapat dicoba ulang.

## Invarian yang harus dipertahankan saat deployment

- Accurate tetap GET-only melalui allowlist `list.do`/`detail.do`. Deployment ini tidak mengaktifkan penulisan PO, SQ, SO, barang atau klien ke Accurate.
- Edit dan persetujuan mengubah draft Intranet saja. Tidak ada proses latar otomatis yang menerbitkannya setelah restart/deployment.
- Pembaruan draft menggunakan lock baris dan versi optimistis. Kunci request mengikat pengguna, PT dan isi draft untuk mencegah duplikasi retry pada beberapa instance.
- Audit bisnis menggunakan trigger yang menolak update, delete dan truncate. Draft dan audit ditulis dalam transaksi yang sama; kegagalan audit membatalkan draft.
- Dokumen yang dibuat master admin masuk tim sesuai jenisnya agar kepala bagian yang tepat dapat melihatnya; akses tetap dibatasi PT aktif.
- Jangan memasang migrasi generik dari proyek WMS atau menjalankan reset/truncate terhadap database bersama. Perubahan DDL Intranet hanya boleh menyebut objek `intranet_` yang relevan.
