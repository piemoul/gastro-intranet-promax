import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { branches, users } from "@/server/db/schema";
import { PageHeader } from "@/components/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { RowActions } from "@/components/row-actions";
import { deleteUser } from "@/server/actions/admin";

export default async function UsersPage() {
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      nickname: users.nickname,
      department: users.department,
      level: users.level,
      branch: branches.name,
    })
    .from(users)
    .leftJoin(branches, eq(users.branchId, branches.id))
    .orderBy(users.name);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${rows.length} pengguna`}
        action={
          <Link href="/admin/users/new" className={buttonVariants()}>
            User Baru
          </Link>
        }
      />
      <Table>
        <THead>
          <TR>
            <TH>Email</TH>
            <TH>Nama</TH>
            <TH>Departemen</TH>
            <TH>Level</TH>
            <TH>Branch</TH>
            <TH className="w-32" />
          </TR>
        </THead>
        <TBody>
          {rows.map((u) => (
            <TR key={u.id}>
              <TD className="font-mono text-xs">{u.email}</TD>
              <TD className="font-medium text-brand-dark">{u.name}</TD>
              <TD>{u.department ?? "—"}</TD>
              <TD>{u.level ?? "—"}</TD>
              <TD>{u.branch ?? "—"}</TD>
              <TD>
                <RowActions
                  editHref={`/admin/users/${u.id}/edit`}
                  remove={deleteUser.bind(null, u.id)}
                  confirmText={`Hapus user "${u.name}"?`}
                />
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
