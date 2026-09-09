"use client";

import { useEffect, useState } from "react";
import ViewingWorkspace from "./viewing-workspace";

type Session = { user: { id: string; email: string; role: "USER" | "ADMIN" } | null; googleAvailable: boolean };

export default function AuthPanel() {
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session request failed");
        const data = await response.json() as Session;
        setSession(data);
        setLoginError(new URLSearchParams(window.location.search).has("auth"));
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);

  const buttonClass = "inline-flex min-h-12 w-full touch-manipulation items-center justify-center rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground";

  return (
    <section aria-labelledby="account-heading" className="w-full min-w-0 rounded-2xl border border-foreground/15 p-6 sm:p-8">
      <h2 id="account-heading" className="text-xl font-semibold">내 영화 기록</h2>
      <div className="mt-4" aria-live="polite" aria-busy={!session && !failed}>
        {failed ? (
          <>
            <p className="mb-5 text-sm leading-6">로그인 상태를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.</p>
            <button type="button" className={buttonClass} onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>다시 시도</button>
          </>
        ) : !session ? (
          <p className="text-sm leading-6">로그인 상태 확인 중…</p>
        ) : session.user ? (
          <>
            <p className="text-sm leading-6 break-all">{session.user.email}</p>
            <p className="mt-2 mb-6 text-sm leading-6">로그인했어요. 나만의 관람 기록을 남겨보세요.</p>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className={buttonClass}>로그아웃</button>
            </form>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm leading-6">Google 계정으로 로그인해 내 기록을 시작하세요.</p>
            {loginError && <p role="alert" className="mb-4 text-sm leading-6">로그인을 완료하지 못했어요. 다시 시도해 주세요.</p>}
            {session.googleAvailable ? (
              <a className={buttonClass} href="/api/auth/google">Google로 로그인</a>
            ) : (
              <>
                <button type="button" className={`${buttonClass} opacity-50`} disabled aria-describedby="login-unavailable">Google로 로그인</button>
                <p id="login-unavailable" className="mt-4 text-sm leading-6">로그인 서비스를 준비 중이에요. 잠시 후 다시 방문해 주세요.</p>
              </>
            )}
          </>
        )}
      </div>
      {session?.user ? <ViewingWorkspace key={session.user.id} /> : null}
    </section>
  );
}
