"use client";
import Link from "next/link";
import { createContext, useContext, useEffect, useState } from "react";
import { api, button } from "./shared";
const UserContext = createContext("");
export const memoryDrafts = new Map<string, unknown>();
export const useUserId = () => useContext(UserContext);
export function clearDrafts() {
  memoryDrafts.clear();
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("reelink:draft:")) sessionStorage.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}
type Session = {
  user: { id: string; email: string } | null;
  googleAvailable: boolean;
};
export default function RecordsShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loginError, setLoginError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Session>("/auth/session", undefined, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        try {
          const previous = sessionStorage.getItem("reelink:user");
          if (value.user && previous && previous !== value.user.id)
            clearDrafts();
          if (value.user) sessionStorage.setItem("reelink:user", value.user.id);
        } catch {
          /* Login works without storage. */
        }
        setSession(value);
        setLoginError(new URLSearchParams(window.location.search).has("auth"));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <div className="mx-auto min-h-svh max-w-4xl px-5 sm:px-10">
      <header className="flex min-h-20 items-center justify-between gap-4 border-b border-foreground/15">
        <Link
          href="/viewings"
          className="py-3 font-semibold tracking-widest focus-visible:outline-2"
          translate="no"
        >
          REELINK
        </Link>
        {session?.user ? (
          <form
            action="/api/auth/logout"
            method="post"
            onSubmit={() => clearDrafts()}
          >
            <button className="min-h-12 px-3 text-sm underline-offset-4 hover:underline focus-visible:outline-2">
              로그아웃
            </button>
          </form>
        ) : null}
      </header>
      <main id="main-content" className="py-8 sm:py-12">
        {failed ? (
          <div role="alert">
            <p>로그인 상태를 확인하지 못했어요.</p>
            <button
              className={button}
              onClick={() => {
                setFailed(false);
                setAttempt((value) => value + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        ) : !session ? (
          <p role="status">로그인 상태 확인 중…</p>
        ) : session.user ? (
          <UserContext value={session.user.id}>
            <div key={session.user.id}>{children}</div>
          </UserContext>
        ) : (
          <section className="max-w-md py-12">
            <h1 className="text-3xl font-semibold leading-snug">
              영화가 끝난 뒤에도,
              <br />
              나의 기록은 계속.
            </h1>
            <p className="my-6">Google 계정으로 내 영화 기록을 시작하세요.</p>
            {loginError ? (
              <p role="alert" className="mb-5">
                로그인을 완료하지 못했어요. 다시 시도해 주세요.
              </p>
            ) : null}
            {session.googleAvailable ? (
              <a href="/api/auth/google" className={button}>
                Google로 로그인
              </a>
            ) : (
              <p>로그인 서비스를 준비 중이에요.</p>
            )}
          </section>
        )}
      </main>
      <footer className="border-t border-foreground/15 py-6 text-xs leading-5 text-foreground/70">
        <a href="https://www.themoviedb.org" className="underline">
          영화 데이터: TMDB
        </a>
        <p lang="en">
          This product uses the TMDB API but is not endorsed or certified by
          TMDB.
        </p>
      </footer>
    </div>
  );
}
