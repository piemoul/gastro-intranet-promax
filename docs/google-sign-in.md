# Google Sign-In

Google Cloud project: `gastro-intranet-2026`. OAuth application: `Gastro Intranet`, tipe Web application. Pemilik/master admin aplikasi: `malesmikirbos@gmail.com`.

Status Google Auth Platform sudah **In production**. Akses data Intranet tetap dibatasi whitelist aplikasi; master admin tidak perlu menambahkan pengguna sebagai test user Google. Halaman informasi privasi publik berada di `/privacy`.

Callback yang diizinkan:

- `http://localhost:3100/api/auth/google/callback`
- `https://gastro-intranet.vercel.app/api/auth/google/callback`

Scope aplikasi hanya `openid email profile`. Aplikasi tidak meminta Gmail, Drive, Calendar, atau akses Google Cloud. Tidak ada shared password WMS, akun demo, public signup, maupun endpoint bypass login.

Backend memeriksa issuer, audience, signature RS256, expiration, nonce, state sekali pakai dan PKCE. Email harus terverifikasi dan merupakan Gmail atau alamat Google Workspace yang otoritatif. Setelah login pertama, identitas dipasangkan ke Google `sub`, sehingga perubahan pemilik email tidak otomatis mengambil alih akun.

Master admin menambahkan email di menu **Pengguna**, memilih role dan PT yang diizinkan. Role dan akses selalu dibaca ulang dari database. Perubahan role/PT atau penonaktifan mencabut seluruh sesi pengguna. Akun master admin tidak dapat diubah/dinonaktifkan lewat fitur ini.

Cookie sesi HTTP-only, SameSite=Lax, Secure pada HTTPS, berlaku 12 jam. Token sesi hanya disimpan sebagai hash. POST/PUT memerlukan Origin yang cocok dengan `APP_URL`. Preview Vercel tidak otomatis menjadi callback OAuth; gunakan domain produksi yang sudah terdaftar.

Konfigurasi Google disimpan di `.env.local` serta environment production Vercel. File konfigurasi lokal di Downloads memiliki izin baca terbatas. Jangan commit/download ulang ke direktori publik.

Sumber: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) dan [Google backend identity verification](https://developers.google.com/identity/sign-in/web/backend-auth).
