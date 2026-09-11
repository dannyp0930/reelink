"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import Image from "next/image";

type Movie = { id: string; title: string };
type Result = { tmdbId: number; title: string; originalTitle: string | null; releaseDate: string | null; posterUrl: string | null };
type Search = { page: number; totalPages: number; results: Result[] };
type Cinema = { id: string; name: string; status: "ACTIVE" | "TEMPORARILY_CLOSED" | "CLOSED" };
type Viewing = { id: string; movie: Movie; watchedOn: string; ratingHalfStars: number | null; note: string | null };

const button = "min-h-12 rounded-xl border border-foreground/30 px-4 py-2 text-sm font-semibold hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50 touch-manipulation";
const field = "mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-foreground/30 bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2";
const dateFormat = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "UTC" });

function RatingField() {
  const [rating, setRating] = useState("");
  const star = "m12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.6l6.3-.9Z";
  const radio = "peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default";
  return <fieldset className="min-w-0 text-sm font-medium" aria-describedby="rating-help">
    <legend>내 평점</legend>
    <span id="rating-help" className="sr-only">선택한 별을 다시 누르거나 Delete 키를 누르면 평점을 해제합니다.</span>
    <span className="sr-only" aria-live="polite">{rating === "" ? "미평가" : `${rating}점`}</span>
    {rating === "" ? <input type="hidden" name="rating" value="" /> : null}
    <div className="mt-2 flex w-full max-w-60">
      {Array.from({ length: 5 }, (_, index) => <div key={index} className="relative flex min-h-12 w-1/5">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute inset-0 h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d={star} /></svg>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute inset-0 h-full w-full" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" style={{ clipPath: `inset(0 ${100 - Math.min(1, Math.max(0, Number(rating) - index)) * 100}% 0 0)` }}><path d={star} /></svg>
        {[0.5, 1].map(half => <label key={half} className="relative min-h-12 w-1/2 touch-manipulation">
          <input type="radio" name="rating" value={index + half} checked={rating === String(index + half)} onChange={event => setRating(event.target.value)}
            onClick={() => { if (rating === String(index + half)) setRating(""); }}
            onKeyDown={event => { if (event.key === "Delete") { event.preventDefault(); setRating(""); } }}
            aria-label={`${index + half}점`} autoComplete="off" className={radio} />
          <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-sm peer-enabled:peer-hover:bg-foreground/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50" />
        </label>)}
      </div>)}
    </div>
  </fieldset>;
}

function Poster({ url, title }: { url: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex h-[90px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-foreground/10">
    {url && !failed ? <Image src={url} alt={`${title} 포스터`} width={60} height={90} unoptimized loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-contain" onError={() => setFailed(true)} />
      : <span className="px-1 text-center text-xs leading-5">포스터 없음</span>}
  </div>;
}

async function api<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body ? "POST" : "GET", cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

function errorText(error: unknown, action: string): string {
  const status = error instanceof Error ? error.message : "";
  if (status === "401") return "로그인이 만료됐어요. 입력은 유지되지만 다시 로그인하려면 이 화면을 떠나야 하니 메모를 복사해 두세요.";
  if (status === "400") return "입력값을 확인해 주세요. 날짜·평점과 선택한 영화·극장을 확인한 뒤 다시 저장하세요.";
  if (action === "저장") return "저장 완료 여부를 확인하지 못했어요. 중복 기록을 피하려면 아래 최근 기록을 새로고침해 확인한 뒤 다시 시도해 주세요.";
  return `${action}하지 못했어요. 잠시 후 다시 시도해 주세요. 계속 실패하면 서버 설정을 확인해 주세요.`;
}

export default function ViewingWorkspace() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [search, setSearch] = useState<Search | null>(null);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [cinemas, setCinemas] = useState<Cinema[] | null>(null);
  const [records, setRecords] = useState<Viewing[] | null>(null);
  const [cinemaError, setCinemaError] = useState(false);
  const [listError, setListError] = useState(false);
  const [busy, setBusy] = useState<"선택" | "저장" | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchExpired, setSearchExpired] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState<Viewing | null>(null);
  const locked = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLParagraphElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const searchKey = useRef("");
  const composing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    api<Cinema[]>("/cinemas", undefined, controller.signal).then(setCinemas).catch(() => { if (!controller.signal.aborted) setCinemaError(true); });
    api<Viewing[]>("/viewings", undefined, controller.signal).then(setRecords).catch(() => { if (!controller.signal.aborted) setListError(true); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  useEffect(() => () => {
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchRequest.current?.abort();
    searchRequest.current = null;
  }, []);

  function cancelSearch() {
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    searchRequest.current?.abort();
    searchRequest.current = null;
    searchKey.current = "";
    setSearchBusy(false);
  }

  async function run(action: "선택" | "저장", work: () => Promise<void>) {
    if (locked.current) return;
    cancelSearch();
    locked.current = true; setBusy(action); setError(""); setExpired(false);
    try { await work(); }
    catch (caught) { setError(errorText(caught, action)); setExpired(caught instanceof Error && caught.message === "401"); }
    finally { locked.current = false; setBusy(null); }
  }

  async function findMovies(text: string, page = 1) {
    if (locked.current || saved) return;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    const key = new URLSearchParams({ q: text.trim(), page: String(page) }).toString();
    if (searchKey.current === key && searchRequest.current) return;
    cancelSearch();
    setSearch(null); setSearchError(""); setSearchExpired(false);
    if (!text.trim()) return;
    const controller = new AbortController();
    searchRequest.current = controller; searchKey.current = key;
    setSearchBusy(true);
    try {
      const result = await api<Search>(`/movies/search?${key}`, undefined, controller.signal);
      if (searchRequest.current !== controller) return;
      setSearch(result); setSearchedQuery(text.trim());
    } catch (caught) {
      if (searchRequest.current !== controller) return;
      setSearchError(errorText(caught, "검색"));
      setSearchExpired(caught instanceof Error && caught.message === "401");
    } finally {
      if (searchRequest.current === controller) { searchRequest.current = null; setSearchBusy(false); }
    }
  }

  function scheduleSearch(text: string) {
    // IME commit can repeat the visible value; do not restart a completed search.
    if (text === query) return;
    setQuery(text);
    cancelSearch();
    setSearch(null); setSearchError(""); setSearchExpired(false);
    // A Korean IME may keep the last syllable composing until blur. Search its
    // visible value after idle time without forcing composition or focus to end.
    if (text.trim() && !locked.current && !saved) {
      searchTimer.current = setTimeout(() => { void findMovies(text); }, 400);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!movie || saved) return;
    const data = new FormData(event.currentTarget);
    void run("저장", async () => {
      const viewing = await api<Viewing>("/viewings", {
        movieId: movie.id, watchedOn: data.get("watchedOn"),
        rating: data.get("rating") === "" ? null : Number(data.get("rating")),
        cinemaId: data.get("cinemaId") || null,
        auditorium: data.get("auditorium") || null, note: data.get("note") || null,
      });
      setSaved(viewing); setDirty(false);
      // Keep the successful write visible even if a subsequent list refresh fails.
      setRecords(previous => [viewing, ...(previous ?? []).filter(item => item.id !== viewing.id)].sort((a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.id.localeCompare(a.id)).slice(0, 50));
    });
  }

  async function refreshRecords() {
    setListError(false);
    try { setRecords(await api<Viewing[]>("/viewings")); }
    catch { setListError(true); }
  }

  async function refreshCinemas() {
    setCinemaError(false);
    try { setCinemas(await api<Cinema[]>("/cinemas")); }
    catch { setCinemaError(true); }
  }

  return (
    <div className="mt-8 space-y-8 border-t border-foreground/15 pt-8">
      <section aria-labelledby="viewing-heading">
        <h3 id="viewing-heading" className="text-xl font-semibold text-balance">관람 기록 남기기</h3>
        <p className="mt-2 text-sm leading-6">영화를 찾고, 그날의 감상을 남겨보세요. 같은 영화도 관람한 회차마다 기록할 수 있어요.</p>
        <form className="mt-5" onSubmit={event => { event.preventDefault(); if (!composing.current) void findMovies(query); }}>
          <label htmlFor="movie-query" className="text-sm font-medium">영화 제목</label>
            <input id="movie-query" name="q" type="search" autoComplete="off" required maxLength={200} value={query}
              onChange={event => scheduleSearch(event.target.value)}
              onCompositionStart={() => { composing.current = true; }}
              onCompositionEnd={event => { composing.current = false; scheduleSearch(event.currentTarget.value); }}
              onKeyDown={event => { if (event.key === "Enter" && (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
              className={field} placeholder="예: 기생충…" disabled={!!busy || !!saved} />
        </form>
        <div role="status" className="mt-3 text-sm">{busy === "선택" ? "영화 정보 확인 중…" : searchBusy ? "검색 중…" : search ? (search.results.length ? `${search.page} / ${Math.max(1, search.totalPages)} 페이지` : "검색 결과가 없어요. 다른 제목으로 검색해 주세요.") : ""}</div>
        {searchError ? <p role="alert" className="mt-3 text-sm leading-6">{searchError}</p> : null}
        {searchExpired ? <a href="/api/auth/google" className={`${button} mt-2 inline-flex items-center`}>다시 로그인</a> : null}
        {search && search.results.length > 0 ? (
          <>
            <div role="region" aria-label="영화 검색 결과" tabIndex={0} className="mt-3 max-h-[min(28rem,55svh)] overflow-y-auto rounded-xl border border-foreground/20 px-3 [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-offset-2">
            <ul className="divide-y divide-foreground/15">
              {search.results.map(result => <li key={result.tmdbId} className="flex min-w-0 items-center gap-3 py-3">
                <Poster key={result.posterUrl} url={result.posterUrl} title={result.title} />
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <p className="font-medium">{result.title}</p>
                  <p className="mt-1 text-sm">{result.releaseDate ? dateFormat.format(new Date(`${result.releaseDate}T00:00:00Z`)) : "개봉일 미상"}{result.originalTitle && result.originalTitle !== result.title ? ` · ${result.originalTitle}` : ""}</p>
                </div>
                <button type="button" className={`${button} shrink-0`} disabled={!!busy || !!saved} aria-label={`${result.title} 선택`} onClick={() => void run("선택", async () => {
                  setMovie(await api<Movie>(`/movies/tmdb/${result.tmdbId}`, {})); setDirty(true);
                  requestAnimationFrame(() => dateInput.current?.focus());
                })}>선택</button>
              </li>)}
            </ul>
            </div>
            <nav aria-label="영화 검색 페이지" className="mt-3 flex gap-2">
              <button type="button" className={button} disabled={!!busy || !!saved || search.page <= 1} onClick={() => findMovies(searchedQuery, search.page - 1)}>이전 검색 결과</button>
              <button type="button" className={button} disabled={!!busy || !!saved || search.page >= search.totalPages} onClick={() => findMovies(searchedQuery, search.page + 1)}>다음 검색 결과</button>
            </nav>
          </>
        ) : null}
        {movie ? <form ref={form} className="mt-6 space-y-5" onSubmit={save} onChange={() => setDirty(true)}>
          <p className="font-semibold [overflow-wrap:anywhere]">선택한 영화: {movie.title}</p>
          <fieldset disabled={!!busy || !!saved} className="grid min-w-0 gap-5 sm:grid-cols-2">
            <legend className="sr-only">관람 정보</legend>
            <label className="min-w-0 text-sm font-medium">관람 날짜<input ref={dateInput} name="watchedOn" type="date" min="0001-01-01" max="9999-12-31" required autoComplete="off" className={field} /></label>
            <RatingField />
            <div className="min-w-0"><label className="text-sm font-medium">극장<select name="cinemaId" defaultValue="" className={field} autoComplete="off">
              <option value="">미지정</option>
              {cinemas?.map(cinema => <option key={cinema.id} value={cinema.id}>{cinema.name}{cinema.status === "CLOSED" ? " (폐업)" : cinema.status === "TEMPORARILY_CLOSED" ? " (휴업)" : ""}</option>)}
            </select></label>
              <p className="mt-2 text-sm" role="status">{cinemaError ? "극장 목록을 불러오지 못했어요. 미지정으로 저장하거나 다시 시도해 주세요." : cinemas === null ? "극장 목록 불러오는 중…" : cinemas.length === 0 ? "등록된 극장이 없어요. 지금은 미지정으로 저장할 수 있어요." : "과거 관람을 위해 폐업·휴업 극장도 표시해요."}</p>
              {cinemaError ? <button type="button" className={`${button} mt-2`} onClick={() => void refreshCinemas()}>극장 목록 다시 시도</button> : null}
            </div>
            <label className="min-w-0 text-sm font-medium">상영관<input name="auditorium" maxLength={100} autoComplete="off" className={field} placeholder="예: 1관…" /></label>
            <label className="min-w-0 text-sm font-medium sm:col-span-2">메모<textarea name="note" maxLength={5000} rows={4} autoComplete="off" className={field} placeholder="기억하고 싶은 장면이나 감상…" /><span className="mt-2 block text-sm">선택 입력 · 최대 5,000자</span></label>
          </fieldset>
          <button className={`${button} bg-foreground text-background hover:opacity-85 hover:bg-foreground`} disabled={!!busy || !!saved}>{busy === "저장" ? "저장 중…" : "관람 기록 저장"}</button>
        </form> : null}
        {error ? <div className="mt-4"><p ref={errorBox} tabIndex={-1} role="alert" className="rounded-xl border border-foreground/30 p-3 text-sm leading-6 focus-visible:outline-2">{error}</p>{expired ? <a href="/api/auth/google" className={`${button} mt-2 inline-flex items-center`}>다시 로그인</a> : null}</div> : null}
        <div role="status" className="mt-4 text-sm">{saved ? "관람 기록을 저장했어요." : ""}</div>
        {saved ? <button type="button" className={`${button} mt-2`} onClick={() => { form.current?.reset(); setMovie(null); setSaved(null); setSearch(null); setQuery(""); setError(""); }}>새 관람 기록</button> : null}
      </section>
      <section aria-labelledby="recent-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 id="recent-heading" className="text-xl font-semibold">최근 관람 기록</h3><button type="button" className={button} disabled={busy === "저장"} onClick={() => void refreshRecords()}>기록 새로고침</button></div>
        <p className="mt-2 text-sm">관람 날짜순 최근 50건 · 수정·삭제 화면은 준비 중이에요.</p>
        {listError ? <p role="alert" className="mt-3 text-sm">기록을 불러오지 못했어요. 기록 새로고침으로 다시 시도해 주세요.</p> : null}
        {records === null ? <p className="mt-3 text-sm" role="status">{listError ? "" : "기록 불러오는 중…"}</p> : records.length === 0 ? <p className="mt-3 text-sm">아직 관람 기록이 없어요. 첫 영화를 남겨보세요.</p> : <ul className="mt-3 divide-y divide-foreground/15">{records.map(record => <li key={record.id} className="py-4 [overflow-wrap:anywhere]">
          <p className="font-semibold">{record.movie.title}</p>
          <p className="mt-1 text-sm tabular-nums">{dateFormat.format(new Date(record.watchedOn))} · <span>{record.ratingHalfStars === null ? "미평가" : `${record.ratingHalfStars / 2}점`}</span></p>
          {record.note ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{record.note}</p> : null}
        </li>)}</ul>}
      </section>
      <aside aria-label="영화 데이터 출처" className="border-t border-foreground/15 pt-5 text-xs leading-5">
        <p>영화 데이터 출처: <a href="https://www.themoviedb.org" className="underline hover:no-underline focus-visible:outline-2" translate="no">TMDB</a></p>
        <p lang="en" className="mt-1">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      </aside>
    </div>
  );
}
