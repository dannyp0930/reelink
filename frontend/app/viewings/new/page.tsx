import { Suspense } from "react";
import RecordForm from "../record-form";
export default function Page() {
  return (
    <Suspense fallback={<p>작성 화면 준비 중…</p>}>
      <RecordForm />
    </Suspense>
  );
}
