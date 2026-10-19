# Google Sign-In

Google Cloud project: `gastro-intranet-2026`. OAuth application: `Gastro Intranet`, tipe Web application. Pemilik/master admin aplikasi: `malesmikirbos@gmail.com`.

Status Google Auth Platform sudah **In production**. Akses data Intranet tetap dibatasi whitelist aplikasi; master admin tidak perlu menambahkan pengguna sebagai test user Google. Halaman informasi privasi publik berada di `/privacy`.

Callback deployment yang perlu diizinkan pada OAuth client yang dipakai:

- `http://localhost:3100/api/auth/google/callback`
- `https://gastro-intranet.vercel.app/api/auth/google/callback`
- `https://intranet.davay.space/api/auth/google/callback` untuk Docker Desktop melalui Cloudflare.

Untuk domain Cloudflare, set `APP_URL=https://intranet.davay.space` dan gunakan OAuth client bertipe **Web application** dengan redirect URI persis seperti di atas. Domain aplikasi ini tidak otomatis mewarisi konfigurasi OAuth deployment Vercel. Client ID dan client secret harus berasal dari client yang sama; simpan keduanya hanya dalam `.env.local` sebagai `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`.

Compose membaca `.env.local` saat container dibuat. Setelah konfigurasi diisi atau diganti, terapkan dengan:

```sh
docker compose --env-file .env.local up -d --force-recreate app
```

Halaman `/login` hanya menampilkan tombol Google bila kedua nilai tersedia. `GET /api/auth/google` yang terkonfigurasi harus mengarah ke Google dengan `redirect_uri=https://intranet.davay.space/api/auth/google/callback`; bila belum dikonfigurasi, endpoint mengarah kembali ke `/login?error=configuration`. Login menyeluruh tetap memerlukan verifikasi akun Google dan whitelist aplikasi.

Scope aplikasi hanya `openid email profile`. Aplikasi tidak meminta Gmail, Drive, Calendar, atau akses Google Cloud. Tidak ada shared password WMS, akun demo, public signup, maupun endpoint bypass login.

Backend memeriksa issuer, audience, signature RS256, expiration, nonce, state sekali pakai dan PKCE. Email harus terverifikasi dan merupakan Gmail atau alamat Google Workspace yang otoritatif. Setelah login pertama, identitas dipasangkan ke Google `sub`, sehingga perubahan pemilik email tidak otomatis mengambil alih akun.

Master admin menambahkan email di menu **Pengguna**, memilih role dan PT yang diizinkan. Role dan akses selalu dibaca ulang dari database. Perubahan role/PT atau penonaktifan mencabut seluruh sesi pengguna. Akun master admin tidak dapat diubah/dinonaktifkan lewat fitur ini.

Cookie sesi HTTP-only, SameSite=Lax, Secure pada HTTPS, berlaku 12 jam. Token sesi hanya disimpan sebagai hash. POST/PUT memerlukan Origin yang cocok dengan `APP_URL`. Preview Vercel tidak otomatis menjadi callback OAuth; gunakan domain produksi yang sudah terdaftar.

Konfigurasi Google untuk Docker disimpan di `.env.local`; deployment Vercel lama memakai environment production tersendiri. Jangan commit atau menyalin konfigurasi ke direktori publik. Lihat [daftar environment dan operasi Docker](environment.md) untuk konfigurasi repository Promax.

Sumber: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) dan [Google backend identity verification](https://developers.google.com/identity/sign-in/web/backend-auth).
