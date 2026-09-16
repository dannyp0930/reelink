import { redirect } from "next/navigation";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string }>;
}) {
  const { auth } = await searchParams;
  redirect(auth ? `/viewings?auth=${encodeURIComponent(auth)}` : "/viewings");
}
