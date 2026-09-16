import { Suspense } from "react";
import RecordList from "./record-list";
export default function Page() {
  return (
    <Suspense fallback={<p>기록 불러오는 중…</p>}>
      <RecordList />
    </Suspense>
  );
}
