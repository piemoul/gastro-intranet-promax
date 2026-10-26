# Environment dan Docker Desktop

Repository deployment ini: https://github.com/piemoul/gastro-intranet-promax. Source awal berasal dari `ko-indra/gastro-intranet` pada commit `b6b29ee`; histori Git dipertahankan.

## Konfigurasi privat

Salin `.env.example` menjadi `.env.local`, lalu isi nilai pada mesin deployment. File itu diabaikan Git dan tidak disalin ke image Docker. Jangan memasukkan secret ke `NEXT_PUBLIC_*` atau dokumentasi.

| Variabel | Kebutuhan |
| --- | --- |
| `APP_URL` | Origin yang dipakai browser. Deployment ini menggunakan `https://intranet.davay.space`, tanpa trailing slash. |
| `GOOGLE_CLIENT_ID` | ID OAuth client bertipe Web application. |
| `GOOGLE_CLIENT_SECRET` | Secret dari OAuth client yang sama. |
| `INTRANET_WMS_ENV_FILE` | Dikosongkan oleh Compose. Container tidak memasang atau membaca file environment WMS. |
| `ACCURATE_HOST` | Host Accurate yang diizinkan; umumnya `https://iris.accurate.id`. |
| `ACCURATE_SIGNATURE_KEY` | Key signature integrasi Accurate. |
| `ACCURATE_API_TOKEN` | Token PT Gastro Gizi Sarana. |
| `ACCURATE_API_TOKEN_RSP` | Token PT Resto Sarana Prima. |
| `ACCURATE_API_TOKEN_SARANA` | Token PT Sarana Refrigeratama. |
| `DATABASE_URL` | Opsional untuk menjalankan aplikasi langsung dengan PostgreSQL/Neon. **Compose yang disertakan mengosongkannya secara eksplisit dan memakai SQLite.** |
| `INTRANET_DATA_DIR` | Untuk runtime langsung tanpa PostgreSQL. Compose menetapkannya ke `/app/.data` dalam volume persisten. |
| `INTRANET_TEST_DATABASE_URL` | Hanya tes PostgreSQL dengan database pengujian khusus. Dikosongkan dalam container aplikasi. |

Isi kelima variabel Accurate langsung dalam `.env.local`. Compose meneruskannya sebagai environment container dan tidak lagi memasang file WMS maupun file template sebagai fallback. Key yang digunakan telah disalin sekali dari konfigurasi WMS; perubahan file WMS selanjutnya tidak memengaruhi Intranet. Untuk rotasi key, perbarui `.env.local` Intranet dan buat ulang container aplikasi. Autentikasi dan database WMS tidak dipakai oleh Compose ini.

Sesudah pemisahan konfigurasi, container dibuat ulang dan berstatus sehat. Enam pembacaan GET master barang/klien untuk ketiga PT berhasil; image dan volume data tetap sama, file WMS tidak berubah, serta tidak ada transaksi percobaan. Pemeriksaan ini hanya mengambil satu ID per daftar dan tidak menyalin data bisnis ke dokumentasi.

OAuth redirect URI wajib sama persis dengan origin:

```text
https://intranet.davay.space/api/auth/google/callback
```

Untuk deployment lokal murni, gunakan `APP_URL=http://localhost:3100` dan daftarkan callback `http://localhost:3100/api/auth/google/callback`. Ketika `APP_URL` memakai domain publik, lakukan login dan operasi aplikasi melalui domain tersebut agar pemeriksaan Origin cocok. Pengguna tetap harus terdaftar dalam whitelist Intranet.

## Menjalankan aplikasi

Prasyarat: Docker Desktop dengan Linux containers. Node.js 24 diperlukan hanya untuk menjalankan tool/npm langsung di host.

```powershell
Copy-Item .env.example .env.local
# Isi .env.local melalui editor, tanpa menyalin nilainya ke log.
docker compose --env-file .env.local up -d --build app
docker compose --env-file .env.local ps
```

Aplikasi mendengarkan di `http://localhost:3100`, hanya pada loopback host. Cloudflared yang sudah tersedia meneruskan domain publik ke `http://host.docker.internal:3100`. Tunnel tidak dibuat atau diubah oleh Compose.

Build menjalankan lint, typecheck, unit/integration tests dengan mock Accurate, lalu build Next.js standalone. Runtime memakai user non-root. SQLite, whitelist, sesi, draft dan audit disimpan dalam named volume `gastro-intranet_intranet_data`; jangan menghapus volume untuk update tampilan.

```powershell
# Terapkan environment baru; data volume tetap ada.
docker compose --env-file .env.local up -d --force-recreate app
# Memeriksa log dan menghentikan layanan tanpa menghapus data.
docker compose --env-file .env.local logs --tail 100 app
docker compose --env-file .env.local stop
```

Deployment Neon di luar konfigurasi Compose ini memakai objek `intranet_` saja. Mengisi `DATABASE_URL` dalam `.env.local` tidak mengalihkan Compose ke Neon karena override di `compose.yaml` disengaja.

## Peta Graphify lokal

Graph dan laporan berada di `.graphify/`; cache, manifest mesin, dan file runtime privat tidak dipublikasikan. `.graphifyignore` mengecualikan file environment, log, data privat, dan artefak graph yang dihasilkan, sambil tetap mengizinkan memory pemetaan tanpa secret. Graphify 0.17.1 menggunakan runtime TypeScript. Setelah Graphify terpasang:

```powershell
graphify update . --no-description --no-label
graphify studio export .graphify/studio
docker compose --env-file .env.local up -d graph
```

Buka `http://localhost:3101`. Studio dihasilkan ulang secara lokal dan tidak dimasukkan ke image aplikasi. Perubahan dokumentasi membutuhkan semantic refresh melalui skill Graphify; perintah `update` di CLI ini hanya membangun ulang struktur kode dan mempertahankan node semantik yang sudah ada.

## CI pada repository tujuan

Workflow GitHub tetap menjalankan lint, typecheck, tes termasuk PostgreSQL terisolasi, dan build. Job deployment Vercel dibatasi ke repository asal `ko-indra/gastro-intranet`, sehingga push ke `piemoul/gastro-intranet-promax` tidak menerbitkan perubahan ke deployment lama. Deployment aktif untuk repository tujuan ini adalah Docker Desktop + tunnel yang sudah ada.
