"use client";

import { useState } from "react";
import Image from "next/image";

export type Movie = {
  id: string;
  title: string;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  posterUrl: string | null;
};
export type Result = {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  posterUrl: string | null;
};
export type Search = { page: number; totalPages: number; results: Result[] };
export type Cinema = {
  id: string;
  name: string;
  address: string | null;
  status: "ACTIVE" | "TEMPORARILY_CLOSED" | "CLOSED";
};
export type Viewing = {
  id: string;
  movie: Movie;
  cinema: Cinema | null;
  watchedOn: string;
  watchedTime: string | null;
  viewingType: "THEATER" | "STREAMING" | "OTHER" | null;
  auditorium: string | null;
  screeningFormat: string | null;
  streamingService: string | null;
  viewingDetail: string | null;
  ratingHalfStars: number | null;
  note: string | null;
};
export type ViewingPage = {
  items: Viewing[];
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

export const button =
  "min-h-12 rounded-xl border border-foreground/30 px-4 py-2 text-sm font-semibold hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50 touch-manipulation";
export const field =
  "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-foreground/30 bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2";
export const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "UTC",
});
export const yearFormat = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  timeZone: "UTC",
});

export function MovieInfo({ movie }: { movie: Movie }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Poster
        key={movie.posterUrl ?? movie.id}
        url={movie.posterUrl}
        title={movie.title}
      />
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <p className="font-semibold">{movie.title}</p>
        <p className="mt-1 text-sm">
          {movie.releaseDate
            ? yearFormat.format(new Date(movie.releaseDate))
            : "개봉연도 미상"}{" "}
          ·{" "}
          {movie.runtimeMinutes ? `${movie.runtimeMinutes}분` : "러닝타임 미상"}
        </p>
      </div>
    </div>
  );
}

export function cinemaLabel(cinema: Cinema) {
  return `${cinema.name}${cinema.status === "CLOSED" ? " (폐업)" : cinema.status === "TEMPORARILY_CLOSED" ? " (휴업)" : ""}`;
}

export function RatingField({
  rating,
  setRating,
}: {
  rating: string;
  setRating: (value: string) => void;
}) {
  const star =
    "m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9Z";
  const radio =
    "peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default";
  return (
    <fieldset
      className="min-w-0 text-sm font-medium"
      aria-describedby="rating-help"
    >
      <legend>내 평점</legend>
      <span id="rating-help" className="sr-only">
        선택한 별을 다시 누르거나 Delete 키를 누르면 평점을 해제합니다.
      </span>
      <span className="sr-only" aria-live="polite">
        {rating === "" ? "미평가" : `${rating}점`}
      </span>
      {rating === "" ? <input type="hidden" name="rating" value="" /> : null}
      <div className="mt-2 flex w-full max-w-60">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="relative flex min-h-12 w-1/5">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute inset-0 h-full w-full"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            >
              <path d={star} />
            </svg>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="pointer-events-none absolute inset-0 h-full w-full"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              style={{
                clipPath: `inset(0 ${100 - Math.min(1, Math.max(0, Number(rating) - index)) * 100}% 0 0)`,
              }}
            >
              <path d={star} />
            </svg>
            {[0.5, 1].map((half) => (
              <label
                key={half}
                className="relative min-h-12 w-1/2 touch-manipulation"
              >
                <input
                  type="radio"
                  name="rating"
                  value={index + half}
                  checked={rating === String(index + half)}
                  onChange={(event) => setRating(event.target.value)}
                  onClick={() => {
                    if (rating === String(index + half)) setRating("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Delete") {
                      event.preventDefault();
                      setRating("");
                    }
                  }}
                  aria-label={`${index + half}점`}
                  autoComplete="off"
                  className={radio}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-sm peer-enabled:peer-hover:bg-foreground/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50"
                />
              </label>
            ))}
          </div>
        ))}
      </div>
    </fieldset>
  );
}

export function Poster({ url, title }: { url: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex h-[90px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/10">
      {url && !failed ? (
        <Image
          src={url}
          alt={`${title} 포스터`}
          width={60}
          height={90}
          unoptimized
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="px-1 text-center text-xs leading-5">포스터 없음</span>
      )}
    </div>
  );
}

export async function api<T>(
  path: string,
  body?: object,
  signal?: AbortSignal,
  method = body ? "POST" : "GET",
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.status === 204
    ? (undefined as T)
    : (response.json() as Promise<T>);
}
export function errorText(error: unknown, action: string) {
  const status = error instanceof Error ? error.message : "";
  if (status === "401") return "로그인이 만료됐어요. 다시 로그인해 주세요.";
  if (status === "404") return "기록이 없거나 접근할 수 없어요.";
  if (status === "400") return "입력값을 확인해 주세요.";
  if (action === "저장")
    return "저장 결과를 확인하지 못했어요. 중복 저장 전 내 기록을 확인해 주세요.";
  return `${action}하지 못했어요. 다시 시도해 주세요.`;
}
export function returnPath(value: string | null) {
  if (!value || !/^\/viewings(?:\?|$)/.test(value)) return "/viewings";
  const query = new URLSearchParams(value.split("?")[1]);
  const safe = new URLSearchParams();
  for (const key of ["rating", "sort", "page", "view", "month", "date"]) {
    const item = query.get(key);
    if (item) safe.set(key, item);
  }
  return "/viewings" + (safe.size ? `?${safe}` : "");
}
export function experience(record: Viewing) {
  return [
    record.viewingType === "THEATER"
      ? "극장"
      : record.viewingType === "STREAMING"
        ? "OTT"
        : record.viewingType === "OTHER"
          ? "기타"
          : "",
    record.cinema ? cinemaLabel(record.cinema) : "",
    record.auditorium,
    record.screeningFormat,
    record.streamingService,
    record.viewingDetail,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function RatingText({ value }: { value: number | null }) {
  if (value === null) return <span>미평가</span>;
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums"
      aria-label={value / 2 + "점"}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5"
        fill="currentColor"
      >
        <path d="m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9Z" />
      </svg>
      {value / 2}
    </span>
  );
}
