/* eslint-disable @next/next/no-html-link-for-pages -- OAuth requires a full browser navigation, not an RSC prefetch. */
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { googleConfigured } from "@/server/auth/google";
import { LockKeyhole, ArrowRight, ShieldCheck } from "lucide-react";
import styles from "./login.module.css";
export const dynamic = "force-dynamic";
const messages: Record<string, string> = {
  configuration: "Google Sign-In sedang disiapkan oleh administrator.",
  whitelist:
    "Akun Google ini belum diizinkan. Hubungi master admin untuk mendapatkan akses.",
  login: "Login belum berhasil atau sesi telah kedaluwarsa. Silakan coba lagi.",
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getActor()) redirect("/");
  const configured = googleConfigured();
  const { error } = await searchParams;
  return (
    <main className={styles.page}>
      <section className={styles.brand}>
        <Image
          src="/gastro-logo.webp"
          width={164}
          height={52}
          alt="Gastro"
          className={styles.logo}
        />
        <div>
          <span className={styles.eyebrow}>GASTRO WORKSPACE</span>
          <h1>
            Satu ruang.
            <br />
            Kerja lebih terarah.
          </h1>
          <p>
            Penawaran, pesanan, dan master data.
            <br />
            Terhubung untuk tiga perusahaan.
          </p>
          <div className={styles.flow}>
            <span>Penawaran</span>
            <ArrowRight size={16} />
            <span>Pesanan</span>
            <ArrowRight size={16} />
            <span>WMS</span>
          </div>
        </div>
        <small>Intranet · Gastro Group</small>
      </section>
      <section className={styles.signin}>
        <div className={styles.card}>
          <div className={styles.icon}>
            <LockKeyhole size={25} />
          </div>
          <span className={styles.eyebrow}>SELAMAT DATANG</span>
          <h2>Masuk ke Intranet</h2>
          <p>
            Gunakan akun Google yang sudah terdaftar untuk membuka ruang kerja
            Anda.
          </p>
          {error && messages[error] && (
            <div role="alert" className={styles.error}>
              {messages[error]}
            </div>
          )}
          {configured ? (
            <a className={styles.google} href="/api/auth/google">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.61 4.61 0 0 1-2 3.03v2.52h3.24c1.9-1.75 2.98-4.33 2.98-7.38Z"
                />
                <path
                  fill="#34A853"
                  d="M12 22c2.7 0 4.96-.9 6.62-2.39l-3.24-2.52c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.6A10 10 0 0 0 12 22Z"
                />
                <path
                  fill="#FBBC05"
                  d="M6.42 13.93A6.02 6.02 0 0 1 6.1 12c0-.67.12-1.32.32-1.93v-2.6H3.08A10 10 0 0 0 2 12c0 1.61.38 3.14 1.08 4.53l3.34-2.6Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.86-2.86C16.95 2.97 14.7 2 12 2a10 10 0 0 0-8.92 5.47l3.34 2.6C7.2 7.71 9.4 5.95 12 5.95Z"
                />
              </svg>
              Masuk dengan Google
              <ArrowRight size={18} />
            </a>
          ) : (
            <div className={styles.setup} role="status">
              <strong>Login sedang disiapkan</strong>
              <span>
                Konfigurasi Google Sign-In belum tersedia. Akses aplikasi tetap
                terlindungi.
              </span>
            </div>
          )}
          <div className={styles.security}>
            <ShieldCheck size={18} />
            <span>Hanya akun yang diizinkan master admin.</span>
          </div>
          <div className={styles.mode}>
            <span />
            Accurate dalam mode hanya baca
          </div>
          <Link href="/privacy" className={styles.privacy}>
            Privasi & penggunaan data
          </Link>
        </div>
        <small className={styles.footer}>
          Gastro Gizi Sarana · Resto Sarana Prima · Sarana Refrigeratama
        </small>
      </section>
    </main>
  );
}
