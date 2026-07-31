import "server-only";
// Server-guarded re-export of the pure hashing core (src/lib/password.ts).
export { hashPassword, verifyPassword } from "@/lib/password";
