"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  api,
  button,
  field,
  dateFormat,
  Poster,
  RatingText,
  experience,
  errorText,
} from "./shared";
import type { ViewingPage } from "./shared";
import { useUserId } from "./shell";
export default function RecordList() {
  const params = useSearchParams();
  const router = useRouter();
  const userId = useUserId();
  const rating = params.get("rating") ?? "all";
  const sort = params.get("sort") ?? "newest";
  const page = params.get("page") ?? "1";
  const query = new URLSearchParams({
    rating,
    sort,
    page,
    limit: "20",
  }).toString();
  const returnTo = "/viewings?" + new URLSearchParams({ rating, sort, page });
  const scrollKey = "reelink:scroll:" + userId + ":" + query;
  const [result, setResult] = useState<{
    query: string;
    data: ViewingPage;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const data = result?.query === query ? result.data : null;
  useEffect(() => {
    const controller = new AbortController();
    api<ViewingPage>("/viewings?" + query, undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setResult({ query, data });
          setError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(errorText(error, "기록을 불러오지"));
      });
    return () => controller.abort();
  }, [query, attempt]);
  useEffect(() => {
    if (!data) return;
    const frame = requestAnimationFrame(() => {
      try {
        window.scrollTo(0, Number(sessionStorage.getItem(scrollKey) ?? 0));
      } catch {
        /* Optional. */
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [data, scrollKey]);
  function rememberScroll() {
    try {
      sessionStorage.setItem(scrollKey, String(window.scrollY));
    } catch {
      /* Optional. */
    }
  }
  function filter(key: string, value: string) {
    const next = new URLSearchParams({ rating, sort, page: "1" });
    next.set(key, value);
    setError("");
    router.push("/viewings?" + next);
  }
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">내 기록</h1>
        <Link
          href={"/viewings/new?returnTo=" + encodeURIComponent(returnTo)}
          onClick={rememberScroll}
          className={
            button +
            " inline-flex items-center bg-foreground text-background hover:bg-foreground hover:opacity-85"
          }
        >
          기록 추가
        </Link>
      </div>
      <div className="mt-8 flex items-center gap-6 border-b border-foreground/15">
        <span className="border-b-2 border-foreground py-3 font-semibold">
          리스트
        </span>
        <span className="py-3 text-sm text-foreground/65">
          캘린더 · 준비 중
        </span>
      </div>
      <div className="my-5 flex flex-wrap items-end gap-3">
        <label className="min-w-28 text-sm">
          평점
          <select
            aria-label="평점"
            name="rating"
            autoComplete="off"
            className={field}
            value={rating}
            onChange={(event) => filter("rating", event.target.value)}
          >
            <option value="all">모든 평점</option>
            <option value="unrated">미평가</option>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={String(i / 2)}>
                {i / 2}점
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-36 text-sm">
          정렬
          <select
            aria-label="정렬"
            name="sort"
            autoComplete="off"
            className={field}
            value={sort}
            onChange={(event) => filter("sort", event.target.value)}
          >
            <option value="newest">최근 관람순</option>
            <option value="oldest">오래된 관람순</option>
            <option value="rating">높은 평점순</option>
          </select>
        </label>
        {data ? (
          <p className="ml-auto pb-3 text-sm tabular-nums">
            {data.totalItems}개의 기록
          </p>
        ) : null}
      </div>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button
            className={button + " mt-3"}
            onClick={() => setAttempt((value) => value + 1)}
          >
            다시 시도
          </button>
          <a href="/api/auth/google" className="ml-4 underline">
            다시 로그인
          </a>
        </div>
      ) : !data ? (
        <p role="status">기록 불러오는 중…</p>
      ) : data.items.length === 0 ? (
        <div className="py-12">
          <p className="text-foreground/70">조건에 맞는 기록이 없어요.</p>
          {data.page > 1 ? (
            <Link
              className="mt-4 inline-flex min-h-12 items-center underline"
              href={
                "/viewings?" + new URLSearchParams({ rating, sort, page: "1" })
              }
            >
              첫 페이지로
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="divide-y divide-foreground/15">
          {data.items.map((record) => (
            <li key={record.id}>
              <Link
                href={
                  "/viewings/" +
                  record.id +
                  "?returnTo=" +
                  encodeURIComponent(returnTo)
                }
                onClick={rememberScroll}
                className="flex min-w-0 gap-4 py-5 focus-visible:outline-2 hover:bg-foreground/5"
              >
                <Poster
                  key={record.movie.posterUrl ?? record.id}
                  url={record.movie.posterUrl}
                  title={record.movie.title}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs tabular-nums text-foreground/70">
                    {dateFormat.format(new Date(record.watchedOn))}
                    {record.watchedTime ? " · " + record.watchedTime : ""}
                  </p>
                  <h2 className="mt-1 break-words text-lg font-semibold">
                    {record.movie.title}
                  </h2>
                  <p className="mt-1 text-sm">
                    <RatingText value={record.ratingHalfStars} />
                    <span className="ml-3 text-foreground/70">
                      {experience(record)}
                    </span>
                  </p>
                  {record.note ? (
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-foreground/70">
                      {record.note}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 ? (
        <nav
          aria-label="기록 페이지"
          className="mt-6 flex items-center justify-between gap-3"
        >
          {data.page > 1 ? (
            <Link
              className={button}
              href={
                "/viewings?" +
                new URLSearchParams({
                  rating,
                  sort,
                  page: String(data.page - 1),
                })
              }
            >
              이전
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm tabular-nums">
            {data.page} / {data.totalPages}
          </span>
          {data.page < data.totalPages ? (
            <Link
              className={button}
              href={
                "/viewings?" +
                new URLSearchParams({
                  rating,
                  sort,
                  page: String(data.page + 1),
                })
              }
            >
              다음
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
