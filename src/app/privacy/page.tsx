import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import styles from "./privacy.module.css";

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/login" aria-label="Kembali ke halaman masuk Intranet">
          <Image
            src="/gastro-logo.webp"
            width={164}
            height={52}
            alt="Gastro"
            className={styles.logo}
          />
        </Link>
        <Link href="/login" className={styles.back}>
          <ArrowLeft size={15} />
          Kembali ke halaman masuk
        </Link>
      </header>
      <article className={styles.card}>
        <div className={styles.intro}>
          <span className={styles.icon}>
            <ShieldCheck size={25} />
          </span>
          <span className={styles.eyebrow}>GASTRO INTRANET</span>
          <h1>Privasi & penggunaan data</h1>
          <p>
            Informasi tentang data yang digunakan untuk masuk dan bekerja di
            Intranet Gastro Group.
          </p>
        </div>
        <div className={styles.sections}>
          <section>
            <h2>Identitas akun Google</h2>
            <p>
              Intranet menggunakan alamat email, nama, dan identitas unik akun
              Google (sub) untuk mengenali pengguna, memeriksa daftar akun yang
              diizinkan, serta mengelola sesi masuk. Aplikasi tidak meminta
              akses ke Gmail, Google Drive, atau kontak Google.
            </p>
          </section>
          <section>
            <h2>Data pekerjaan dan riwayat</h2>
            <p>
              Draft dokumen, usulan master barang atau klien, keputusan
              persetujuan internal, dan riwayat aktivitas disimpan pada database
              Neon. Intranet memakai tabel tersendiri yang dipisahkan dari tabel
              operasional WMS pada database yang sama.
            </p>
            <p>
              Riwayat mencatat identitas pengguna yang melakukan tindakan
              beserta perubahan dokumen agar pekerjaan tim dapat ditelusuri.
            </p>
          </section>
          <section>
            <h2>Accurate dalam mode hanya baca</h2>
            <p>
              Pada tahap ini, Intranet membaca data Accurate sebagai referensi.
              Draft dan usulan perubahan disimpan di Intranet; persetujuan
              internal tidak membuat, mengedit, atau menghapus dokumen di
              Accurate.
            </p>
            <p>
              Kredensial integrasi Accurate digunakan pada server dan tidak
              dikirim ke browser pengguna.
            </p>
          </section>
          <section>
            <h2>Akses sesuai kewenangan</h2>
            <p>
              Hanya akun yang didaftarkan oleh master admin yang dapat masuk.
              Akses dokumen dan fitur dibatasi berdasarkan perusahaan, peran,
              dan kewenangan tim yang dikonfigurasi untuk pengguna.
            </p>
          </section>
          <section className={styles.contact}>
            <h2>Hubungi pengelola</h2>
            <p>
              Untuk pertanyaan tentang data, permintaan akses, koreksi, atau
              penghapusan data pengguna, hubungi pengelola Intranet melalui{" "}
              <a href="mailto:malesmikirbos@gmail.com">
                malesmikirbos@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
      <footer className={styles.footer}>
        Gastro Gizi Sarana · Resto Sarana Prima · Sarana Refrigeratama
      </footer>
    </main>
  );
}
