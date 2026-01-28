import { redirect } from "next/navigation";

export default function NotesSlugRedirect({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/studio?project=${params.slug}`);
}
