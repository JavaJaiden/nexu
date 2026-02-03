import { redirect } from "next/navigation";

export default async function NotesSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/studio?project=${slug}`);
}
