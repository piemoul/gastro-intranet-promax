# Pemeriksaan UX responsif

Pemeriksaan 19 Oktober 2026 pada deployment Docker melalui `https://intranet.davay.space`, menggunakan akun master admin yang sudah terdaftar. Source awal aplikasi: `b6b29ee`.

## Referensi yang dibaca

| Project lokal | Acuan |
| --- | --- |
| Gastro WMS, checkout `gastro-wms`, commit `5eb8e81` | Login satu kolom: logo, judul, kartu putih maksimum 448 px, footer sederhana. |
| Gastro WMS, checkout `gastro-wms-koindra-latest`, commit `d88a7ed` | Sidebar desktop 288 px, context bar 64 px, hamburger kanan, drawer kanan maksimum 352 px / 88vw. |
| Gastro Portal, checkout `GASTRO/Web`, commit `318473c` | Shell Absensi, kelompok navigasi, target sentuh 44 px, label pagination Sebelumnya/Berikutnya. |
| Gastro Web Revamp, commit `5b08b7d` | Hirarki menu mobile, indentasi link, dan tipografi navigasi. |

Repository referensi hanya dibaca. Identitas login Google dan pembatasan akses Intranet tetap memakai implementasi aplikasi ini.

## Perubahan antarmuka

- Login disederhanakan menjadi kartu terpusat dengan satu aksi Google, informasi whitelist, dan tautan privasi. Redirect, pemeriksaan sesi, pesan error dan endpoint OAuth tetap sama.
- Shell menyelaraskan sidebar, context bar, kelompok menu, jarak konten dan ukuran huruf dengan referensi. Mobile/tablet memakai logo kiri dan hamburger kanan; pilihan PT tersedia di dalam drawer.
- Drawer memakai dialog yang sudah ada, tetap mendukung Escape, fokus awal, pengembalian fokus, backdrop, scroll menu dan body scroll lock. Perubahan ukuran ke desktop menutup drawer agar halaman tidak terkunci.
- Breakpoint mobile memakai `width < 1024px`, selaras dengan desktop `min-width: 1024px`; ini menghindari celah akibat pembulatan viewport pecahan.
- Pagination memiliki teks, status halaman yang diumumkan secara sopan, serta target sentuh 44 px. Pada layar sempit, indikator halaman mendapat baris sendiri.
- Kartu tabel mobile memakai kolom label/nilai yang konsisten. Margin lama pada model barang dihapus agar model sejajar dengan merek; label status tetap cukup terbaca.
- Perubahan CSS shell dibatasi pada `.app-shell` dalam `workspace.css`. CSS login menggunakan module tersendiri.

## Verifikasi

| Area | Ukuran / tindakan | Hasil |
| --- | --- | --- |
| Login | 390 × 844 dan 1440 × 900 | Logo proporsional, kartu terpusat, tanpa overflow horizontal. Google account chooser kembali ke Dashboard. |
| Dashboard | 390 × 844 dan 1440 × 900 | Layout mobile dua kolom metrik, sidebar desktop 288 px, header 64 px, konten tidak tertutup header. |
| Master barang | Lebar 320, 390, 768, 1023, 1024 | Kartu pada mobile dan tabel pada tablet/desktop; tidak menambah overflow horizontal halaman. |
| Pagination | Halaman 1 → 2 → 1; lebar 320 dan 390 | Data berganti; status dan tombol disabled sesuai; tombol tidak terpotong. |
| Drawer | Mobile, Escape, menu terakhir, pergantian PT, resize ke 1024 | Navigasi Pengguna tetap dapat dicapai melalui scroll. Escape mengembalikan fokus. Resize memulihkan body scroll. |
| Pembacaan Accurate | GGS barang, RSP klien, SRI barang dan daftar/detail PO | Data terbaca tanpa error aplikasi. PT aktif dipulihkan ke GGS. |
| Form PO | 390 × 844 dan 768 × 1024 | Input satu/dua kolom sesuai lebar; ukuran input 16 px; form dibuka lalu ditutup tanpa diisi/disimpan. |
| Pengguna | Lebar 320 dan 768 | Menu dapat dicapai dan layout tetap di dalam halaman. Tidak ada akun yang ditambahkan/diubah. |

Tabel rincian pada modal tetap mempunyai area scroll horizontal sendiri untuk kolom transaksi; overflow tersebut tidak memperlebar halaman. Pemeriksaan browser mencakup pengukuran DOM serta inspeksi screenshot, bukan seluruh kombinasi perangkat/role. Pembacaan menyeluruh ketiga PT pada tahap sebelumnya dicatat di [laporan Accurate](accurate-connection-check.md); jumlah data live dapat berubah.

Lint, TypeScript, tes yang tersedia, serta build produksi dijalankan dalam Linux Docker. Hasil: **80 lulus, 0 gagal, 2 tes PostgreSQL dilewati** karena tidak diberikan database pengujian eksplisit. Tes publikasi menggunakan mock, tanpa dokumen percobaan di Accurate.

Tidak ada perubahan pada `src/server`, `src/app/api`, `src/lib`, dependency, atau lockfile. Penyesuaian deployment hanya mencakup standalone Docker, fallback file environment Accurate, pengabaian output Graphify oleh lint/deployment, serta guard repository pada job Vercel lama.
