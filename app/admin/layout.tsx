import { requireAnalyst } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/layout/app-shell";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAnalyst();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  return (
    <AppShell
      variant="admin"
      brandHref="/admin"
      brandLabel="Persona AI"
      header={
        <div className="flex flex-1 items-center gap-4">
          <Badge variant="outline" className="hidden sm:inline-flex">
            Internal · Fraud Operations
          </Badge>
          <div className="ml-auto flex items-center gap-1">
            <UserMenu
              name={dbUser ? `${dbUser.firstName} ${dbUser.lastName}` : "Analyst"}
              email={dbUser?.email ?? ""}
              role={user.role}
            />
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
