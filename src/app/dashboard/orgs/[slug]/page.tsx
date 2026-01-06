import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import OrganizationPage from "./organization-page";

type RouteParams = { params: Promise<{ slug: string }> };

export default async function OrganizationDetailPage({ params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { slug } = await params;

  const organization = await db.organization.findFirst({
    where: {
      slug,
      OR: [
        { ownerId: session.userId },
        { members: { some: { userId: session.userId } } },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      createdAt: true,
      ownerId: true,
      owner: {
        select: {
          id: true,
          githubUsername: true,
          avatarUrl: true,
        },
      },
      members: {
        select: {
          id: true,
          role: true,
          user: {
            select: {
              id: true,
              githubUsername: true,
              avatarUrl: true,
            },
          },
          createdAt: true,
        },
      },
      _count: {
        select: {
          repositories: true,
        },
      },
    },
  });

  if (!organization) {
    redirect("/dashboard/orgs");
  }

  const isOwner = organization.ownerId === session.userId;
  const userMembership = organization.members.find(m => m.user.id === session.userId);
  const userRole = isOwner ? "owner" : userMembership?.role || "viewer";

  return (
    <OrganizationPage
      organization={{
        ...organization,
        userRole,
        isOwner,
      }}
    />
  );
}
