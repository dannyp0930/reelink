import { Suspense } from "react";
import RecordDetail from "../../record-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<p>기록 불러오는 중…</p>}>
      <RecordDetail id={id} edit />
    </Suspense>
  );
}
