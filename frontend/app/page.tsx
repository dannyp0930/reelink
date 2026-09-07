import AuthPanel from "./auth-panel";

export default function Home() {
  return (
    <main id="main-content" className="mx-auto flex min-h-svh max-w-5xl flex-col justify-center gap-10 break-keep px-6 py-16 sm:px-12 lg:flex-row lg:items-center lg:gap-20">
      <div className="max-w-md">
        <p translate="no" className="mb-6 text-sm font-semibold tracking-widest">REELINK</p>
        <h1 className="text-4xl font-semibold leading-tight text-balance">영화가 끝난 뒤에도,<br />나의 기록은 계속.</h1>
        <p className="mt-6 text-base leading-7 text-pretty">처음 본 순간부터 다시 보고 달라진 감상까지.<br />영화와 함께한 시간을 모아보세요.</p>
      </div>
      <AuthPanel />
    </main>
  );
}
