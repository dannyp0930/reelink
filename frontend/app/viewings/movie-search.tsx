"use client";
import { useEffect, useRef, useState } from "react";
import { api, button, field, Poster, dateFormat, errorText } from "./shared";
import type { Movie, Search } from "./shared";
export default function MovieSearch({
  onSelect,
}: {
  onSelect: (movie: Movie) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [search, setSearch] = useState<Search | null>(null);
  const [busy, setBusy] = useState<"선택" | "저장" | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchExpired, setSearchExpired] = useState(false);
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);
  const locked = useRef(false);
  const errorBox = useRef<HTMLParagraphElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequest = useRef<AbortController | null>(null);
  const searchKey = useRef("");
  const composing = useRef(false);

  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);

  useEffect(
    () => () => {
      if (searchTimer.current !== null) clearTimeout(searchTimer.current);
      searchRequest.current?.abort();
      searchRequest.current = null;
    },
    [],
  );

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
    locked.current = true;
    setBusy(action);
    setError("");
    setExpired(false);
    try {
      await work();
    } catch (caught) {
      setError(errorText(caught, action));
      setExpired(caught instanceof Error && caught.message === "401");
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  async function findMovies(text: string, page = 1) {
    if (locked.current) return;
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
    const key = new URLSearchParams({
      q: text.trim(),
      page: String(page),
    }).toString();
    if (searchKey.current === key && searchRequest.current) return;
    cancelSearch();
    setSearch(null);
    setSearchError("");
    setSearchExpired(false);
    if (!text.trim()) return;
    const controller = new AbortController();
    searchRequest.current = controller;
    searchKey.current = key;
    setSearchBusy(true);
    try {
      const result = await api<Search>(
        `/movies/search?${key}`,
        undefined,
        controller.signal,
      );
      if (searchRequest.current !== controller) return;
      setSearch(result);
      setSearchedQuery(text.trim());
    } catch (caught) {
      if (searchRequest.current !== controller) return;
      setSearchError(errorText(caught, "검색"));
      setSearchExpired(caught instanceof Error && caught.message === "401");
    } finally {
      if (searchRequest.current === controller) {
        searchRequest.current = null;
        setSearchBusy(false);
      }
    }
  }

  function scheduleSearch(text: string) {
    // IME commit can repeat the visible value; do not restart a completed search.
    if (text === query) return;
    setQuery(text);
    cancelSearch();
    setSearch(null);
    setSearchError("");
    setSearchExpired(false);
    // A Korean IME may keep the last syllable composing until blur. Search its
    // visible value after idle time without forcing composition or focus to end.
    if (text.trim() && !locked.current) {
      searchTimer.current = setTimeout(() => {
        void findMovies(text);
      }, 400);
    }
  }

  return (
    <section aria-label="영화 선택">
      {" "}
      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!composing.current) void findMovies(query);
        }}
      >
        <label htmlFor="movie-query" className="text-sm font-medium">
          영화 제목
        </label>
        <input
          id="movie-query"
          name="q"
          type="search"
          autoComplete="off"
          required
          maxLength={200}
          value={query}
          onChange={(event) => scheduleSearch(event.target.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            scheduleSearch(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (composing.current ||
                event.nativeEvent.isComposing ||
                event.keyCode === 229)
            )
              event.preventDefault();
          }}
          className={field}
          placeholder="예: 기생충…"
          disabled={!!busy}
        />
      </form>
      <div role="status" className="mt-3 text-sm">
        {busy === "선택"
          ? "영화 정보 확인 중…"
          : searchBusy
            ? "검색 중…"
            : search
              ? search.results.length
                ? `${search.page} / ${Math.max(1, search.totalPages)} 페이지`
                : "검색 결과가 없어요. 다른 제목으로 검색해 주세요."
              : ""}
      </div>
      {searchError ? (
        <p role="alert" className="mt-3 text-sm leading-6">
          {searchError}
        </p>
      ) : null}
      {searchExpired ? (
        <a
          href="/api/auth/google"
          className={`${button} mt-2 inline-flex items-center`}
        >
          다시 로그인
        </a>
      ) : null}
      {search && search.results.length > 0 ? (
        <>
          <div
            role="region"
            aria-label="영화 검색 결과"
            tabIndex={0}
            className="mt-3 max-h-[min(28rem,55svh)] overflow-y-auto rounded-xl border border-foreground/20 px-3 [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ul className="divide-y divide-foreground/15">
              {search.results.map((result) => (
                <li
                  key={result.tmdbId}
                  className="flex min-w-0 items-center gap-3 py-3"
                >
                  <Poster
                    key={result.posterUrl}
                    url={result.posterUrl}
                    title={result.title}
                  />
                  <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <p className="font-medium">{result.title}</p>
                    <p className="mt-1 text-sm">
                      {result.releaseDate
                        ? dateFormat.format(
                            new Date(`${result.releaseDate}T00:00:00Z`),
                          )
                        : "개봉일 미상"}
                      {result.originalTitle &&
                      result.originalTitle !== result.title
                        ? ` · ${result.originalTitle}`
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${button} shrink-0`}
                    disabled={!!busy}
                    aria-label={`${result.title} 선택`}
                    onClick={() =>
                      void run("선택", async () => {
                        onSelect(
                          await api<Movie>(`/movies/tmdb/${result.tmdbId}`, {}),
                        );
                      })
                    }
                  >
                    선택
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <nav aria-label="영화 검색 페이지" className="mt-3 flex gap-2">
            <button
              type="button"
              className={button}
              disabled={!!busy || search.page <= 1}
              onClick={() => findMovies(searchedQuery, search.page - 1)}
            >
              이전 검색 결과
            </button>
            <button
              type="button"
              className={button}
              disabled={!!busy || search.page >= search.totalPages}
              onClick={() => findMovies(searchedQuery, search.page + 1)}
            >
              다음 검색 결과
            </button>
          </nav>
        </>
      ) : null}
      {error ? (
        <p ref={errorBox} tabIndex={-1} role="alert">
          {error}
        </p>
      ) : null}
      {expired ? (
        <a href="/api/auth/google" className={button}>
          다시 로그인
        </a>
      ) : null}
    </section>
  );
}
