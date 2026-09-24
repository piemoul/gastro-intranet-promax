# Deployment Intranet

Target aplikasi ini adalah repository privat [ko-indra/gastro-intranet](https://github.com/ko-indra/gastro-intranet) dan proyek Vercel **gastro-intranet** milik **koindras-projects**. URL produksi: [gastro-intranet.vercel.app](https://gastro-intranet.vercel.app).

Implementasi baru menggantikan aplikasi pada proyek tersebut dengan commit lanjutan di `main`; histori Git lama dipertahankan. Tidak diperlukan force push. Proyek WMS tetap terpisah.

## Alur otomatis

Workflow `.github/workflows/ci.yml` berjalan untuk pull request, push ke `main`, dan pemicu manual. Dengan Node.js 24 serta dependency dari lockfile, workflow memeriksa:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

Pemeriksaan database memakai service PostgreSQL 17 yang hanya hidup selama CI. `INTRANET_TEST_DATABASE_URL` diberikan pada langkah `npm test` agar kedua suite PostgreSQL berjalan pada schema terisolasi. `DATABASE_URL` tidak diberikan pada runner sehingga pengujian SQLite lokal tidak beralih ke database production.

Job deployment hanya berjalan setelah seluruh pemeriksaan berhasil dan sumbernya adalah push atau pemicu manual pada `main`. Job tersebut memakai Vercel CLI versi tetap **54.0.0** untuk mengirim source aplikasi ke proyek produksi. Vercel membangun aplikasi dengan environment production miliknya.

Build CI memeriksa source tanpa kredensial layanan. Build kedua di Vercel disengaja agar kredensial Accurate, database, dan Google tidak perlu diunduh ke runner GitHub menggunakan `vercel pull`. Tidak ada panggilan Accurate mutasi dalam pengujian maupun pipeline.

`git.deploymentEnabled: false` dalam `vercel.json` menonaktifkan deployment otomatis dari integrasi Git native Vercel. Dengan demikian, hanya job deployment yang sudah melewati pemeriksaan yang mengirim rilis dari pipeline ini. Deployment `main` yang sedang berjalan tidak dibatalkan ketika commit baru datang; job yang menunggu mengikuti aturan concurrency GitHub.

## Konfigurasi GitHub

Di repository **ko-indra/gastro-intranet**:

| Jenis | Nama | Kegunaan |
| --- | --- | --- |
| Repository variable | `VERCEL_ORG_ID` | Tim Vercel tujuan |
| Repository variable | `VERCEL_PROJECT_ID` | Proyek `gastro-intranet` |
| Repository secret | `VERCEL_TOKEN` | Token deployment yang dibatasi ke proyek Intranet |

Token deployment awal telah dikonfigurasi dengan scope hanya proyek **gastro-intranet** dan masa berlaku sampai **25 September 2027**. Token Vercel harus memiliki masa berlaku yang masih aktif. Token login CLI yang singkat tidak digunakan sebagai credential pipeline jangka panjang. Rotasi dilakukan dengan membuat token pengganti dengan scope proyek yang sama, memperbarui `VERCEL_TOKEN` melalui stdin atau pengelola secret, memverifikasi deployment, lalu mencabut token lama.

Token dan nilai environment tidak boleh masuk repository, keluaran log, screenshot, atau laporan. File `.env*`, `.data/`, `.logs/`, `.vercel/`, dependency, dan output build diabaikan oleh Git dan/atau upload deployment melalui `.gitignore` dan `.vercelignore`.

## Konfigurasi Vercel dan Google

Simpan seluruh kredensial aplikasi sebagai environment **Production** proyek Vercel ini, sesuai daftar pada `.env.example` dan panduan setup aplikasi. Koneksi database production menggunakan Neon yang dipilih untuk Intranet; tabel aplikasi memakai awalan `intranet_`. Kredensial Accurate hanya dipakai oleh transport GET yang diizinkan di server.

Base URL aplikasi dan callback Google harus memakai domain produksi yang sama:

- Aplikasi: `https://gastro-intranet.vercel.app`
- Callback: `https://gastro-intranet.vercel.app/api/auth/google/callback`

Gunakan konfigurasi OAuth yang memang dibuat untuk aplikasi Intranet. Perubahan daftar akun pengguna dilakukan melalui master admin, bukan dengan menjadikan domain email sebagai akses umum.

## Verifikasi rilis

Setelah deployment berhasil, periksa halaman login, alur Google Sign-In, pembatasan akun terdaftar, pemilihan perusahaan, data Accurate hanya baca, serta pembuatan dan persetujuan draft internal. Pengujian produksi tidak boleh mengirim save/delete/approve atau mutasi lain ke Accurate.

Jika pemeriksaan CI gagal, deployment tidak dijalankan. Perbaiki penyebab dan kirim commit baru. Jika rilis yang sudah hidup perlu dikembalikan, pilih deployment Vercel sebelumnya melalui fitur rollback atau lakukan revert commit dan biarkan pipeline menjalankan ulang semua pemeriksaan. Jangan menonaktifkan gate pengujian untuk memaksa rilis.

Referensi: [GitHub Actions dengan Vercel](https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel) dan [konfigurasi Git Vercel](https://vercel.com/docs/project-configuration/git-configuration).
