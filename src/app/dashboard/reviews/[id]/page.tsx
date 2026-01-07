import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import ReviewDetail from "./review-detail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  return <ReviewDetail reviewId={id} />;
}
