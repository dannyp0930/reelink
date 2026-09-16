"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import MovieSearch from "./movie-search";
import CinemaField from "./cinema-field";
import {
  api,
  button,
  field,
  MovieInfo,
  RatingField,
  returnPath,
  errorText,
} from "./shared";
import type { Movie, Cinema, Viewing } from "./shared";
import { useUserId, memoryDrafts, clearDrafts } from "./shell";

type Draft = {
  movie: Movie | null;
  watchedOn: string;
  watchedTime: string;
  viewingType: Viewing["viewingType"];
  contextChanged: boolean;
  cinema: Cinema | null;
  auditorium: string;
  screeningFormat: string;
  streamingService: string;
  viewingDetail: string;
  rating: string;
  note: string;
};
function initial(record: Viewing | undefined, date: string): Draft {
  return {
    movie: record?.movie ?? null,
    watchedOn: record?.watchedOn.slice(0, 10) ?? date,
    watchedTime: record?.watchedTime ?? "",
    viewingType: record?.viewingType ?? null,
    contextChanged: false,
    cinema: record?.cinema ?? null,
    auditorium: record?.auditorium ?? "",
    screeningFormat: record?.screeningFormat ?? "",
    streamingService: record?.streamingService ?? "",
    viewingDetail: record?.viewingDetail ?? "",
    rating:
      record?.ratingHalfStars == null ? "" : String(record.ratingHalfStars / 2),
    note: record?.note ?? "",
  };
}
function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Draft;
  return (
    [
      "watchedOn",
      "watchedTime",
      "auditorium",
      "screeningFormat",
      "streamingService",
      "viewingDetail",
      "rating",
      "note",
    ].every((key) => typeof draft[key as keyof Draft] === "string") &&
    typeof draft.contextChanged === "boolean" &&
    [null, "THEATER", "STREAMING", "OTHER"].includes(draft.viewingType) &&
    (draft.movie === null ||
      (typeof draft.movie?.id === "string" &&
        typeof draft.movie?.title === "string")) &&
    (draft.cinema === null ||
      (typeof draft.cinema?.id === "string" &&
        typeof draft.cinema?.name === "string"))
  );
}
const subscribe = () => () => {};
export default function RecordForm({ record }: { record?: Viewing }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return mounted ? (
    <Editor record={record} />
  ) : (
    <p role="status">작성 화면 준비 중…</p>
  );
}
function Editor({ record }: { record?: Viewing }) {
  const params = useSearchParams();
  const router = useRouter();
  const userId = useUserId();
  const back = returnPath(params.get("returnTo"));
  const storageKey = "reelink:draft:" + userId + ":" + (record?.id ?? "new");
  const [stored] = useState(() => {
    try {
      const text = sessionStorage.getItem(storageKey);
      const value: unknown = text
        ? JSON.parse(text)
        : memoryDrafts.get(storageKey);
      return { draft: validDraft(value) ? value : null, failed: false };
    } catch {
      const value = memoryDrafts.get(storageKey);
      return { draft: validDraft(value) ? value : null, failed: true };
    }
  });
  const [draft, setDraft] = useState(
    () =>
      stored.draft ??
      initial(
        record,
        /^\d{4}-\d{2}-\d{2}$/.test(params.get("watchedOn") ?? "")
          ? params.get("watchedOn")!
          : "",
      ),
  );
  const [dirty, setDirty] = useState(!!stored.draft);
  const [choosing, setChoosing] = useState(
    stored.draft ? !stored.draft.movie : !record,
  );
  const [storageError, setStorageError] = useState(stored.failed);
  const restored = !!stored.draft;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const errorBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error]);
  function change(patch: Partial<Draft>) {
    const next = { ...draft, ...patch };
    memoryDrafts.set(storageKey, next);
    setDraft(next);
    setDirty(true);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  function removeDraft() {
    memoryDrafts.delete(storageKey);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Save is authoritative. */
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.movie || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const theater = draft.viewingType === "THEATER";
    const legacy =
      !!record &&
      record.viewingType === null &&
      draft.viewingType === null &&
      !draft.contextChanged;
    try {
      const session = await api<{ user: { id: string } | null }>(
        "/auth/session",
      );
      if (!session.user) throw new Error("401");
      if (session.user.id !== userId) {
        clearDrafts();
        window.location.reload();
        return;
      }
      const saved = await api<Viewing>(
        record ? "/viewings/" + record.id : "/viewings",
        {
          movieId: draft.movie.id,
          watchedOn: draft.watchedOn,
          watchedTime: draft.watchedTime || null,
          ...(legacy ? {} : { viewingType: draft.viewingType }),
          rating: draft.rating === "" ? null : Number(draft.rating),
          note: draft.note || null,
          cinemaId: theater || legacy ? (draft.cinema?.id ?? null) : null,
          auditorium: theater || legacy ? draft.auditorium || null : null,
          screeningFormat: theater ? draft.screeningFormat || null : null,
          streamingService:
            draft.viewingType === "STREAMING"
              ? draft.streamingService || null
              : null,
          viewingDetail:
            draft.viewingType === "OTHER" ? draft.viewingDetail || null : null,
        },
        undefined,
        record ? "PATCH" : "POST",
      );
      removeDraft();
      setDirty(false);
      router.replace(
        "/viewings/" + saved.id + "?returnTo=" + encodeURIComponent(back),
      );
    } catch (caught) {
      setError(errorText(caught, "저장"));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="mx-auto max-w-2xl">
      <Link
        href={
          record
            ? "/viewings/" + record.id + "?returnTo=" + encodeURIComponent(back)
            : back
        }
        className="inline-flex min-h-12 items-center text-sm underline"
      >
        뒤로
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">
        {record ? "기록 수정" : "기록 추가"}
      </h1>
      <p className="mt-3 text-sm text-foreground/70">
        {choosing ? "1. 영화 선택" : "2. 관람 기록"}
      </p>
      {restored ? (
        <p role="status" className="mt-4 text-sm">
          이 탭의 임시 기록을 복원했어요.
        </p>
      ) : null}
      {choosing ? (
        <MovieSearch
          onSelect={(movie) => {
            change({ movie });
            setChoosing(false);
          }}
        />
      ) : draft.movie ? (
        <form onSubmit={save} autoComplete="off" className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <MovieInfo movie={draft.movie} />
            <button
              type="button"
              className={button + " shrink-0"}
              disabled={busy}
              onClick={() => setChoosing(true)}
            >
              영화 변경
            </button>
          </div>
          <fieldset
            disabled={busy}
            className="grid min-w-0 gap-6 sm:grid-cols-2"
          >
            <legend className="sr-only">관람 정보</legend>
            <label className="min-w-0 text-sm font-medium">
              관람 날짜
              <input
                type="date"
                name="watchedOn"
                min="0001-01-01"
                max="9999-12-31"
                required
                className={field}
                value={draft.watchedOn}
                onChange={(event) => change({ watchedOn: event.target.value })}
              />
            </label>
            <label className="min-w-0 text-sm font-medium">
              시각 <span className="text-foreground/65">(선택)</span>
              <input
                type="time"
                name="watchedTime"
                className={field}
                value={draft.watchedTime}
                onChange={(event) =>
                  change({ watchedTime: event.target.value })
                }
              />
            </label>
            <div className="sm:col-span-2">
              <RatingField
                rating={draft.rating}
                setRating={(rating) => change({ rating })}
              />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium">관람 유형</legend>
              <div className="mt-2 flex gap-2">
                {(
                  [
                    ["THEATER", "극장"],
                    ["STREAMING", "OTT"],
                    ["OTHER", "기타"],
                  ] as const
                ).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={draft.viewingType === type}
                    className={
                      button +
                      (draft.viewingType === type
                        ? " bg-foreground text-background hover:bg-foreground hover:opacity-85"
                        : "")
                    }
                    onClick={() =>
                      change({
                        viewingType: draft.viewingType === type ? null : type,
                        contextChanged: true,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {draft.viewingType === "THEATER" ? (
              <>
                <div className="sm:col-span-2">
                  <CinemaField
                    value={draft.cinema}
                    onChange={(cinema) => change({ cinema })}
                  />
                </div>
                <label className="text-sm font-medium">
                  상영관
                  <input
                    className={field}
                    value={draft.auditorium}
                    name="auditorium"
                    maxLength={100}
                    onChange={(event) =>
                      change({ auditorium: event.target.value })
                    }
                  />
                </label>
                <label className="text-sm font-medium">
                  상영 포맷
                  <input
                    className={field}
                    value={draft.screeningFormat}
                    name="screeningFormat"
                    maxLength={50}
                    placeholder="IMAX, Dolby…"
                    onChange={(event) =>
                      change({ screeningFormat: event.target.value })
                    }
                  />
                </label>
              </>
            ) : null}
            {draft.viewingType === "STREAMING" ? (
              <label className="text-sm font-medium sm:col-span-2">
                플랫폼
                <input
                  list="streaming-options"
                  className={field}
                  value={draft.streamingService}
                  name="streamingService"
                  maxLength={80}
                  onChange={(event) =>
                    change({ streamingService: event.target.value })
                  }
                />
                <datalist id="streaming-options">
                  {["Netflix", "Disney+", "TVING", "WATCHA", "Wavve"].map(
                    (value) => (
                      <option key={value} value={value} />
                    ),
                  )}
                </datalist>
              </label>
            ) : null}
            {draft.viewingType === "OTHER" ? (
              <label className="text-sm font-medium sm:col-span-2">
                관람 상세
                <input
                  list="other-options"
                  className={field}
                  value={draft.viewingDetail}
                  name="viewingDetail"
                  maxLength={200}
                  onChange={(event) =>
                    change({ viewingDetail: event.target.value })
                  }
                />
                <datalist id="other-options">
                  {[
                    "Blu-ray / DVD",
                    "TV 방송",
                    "기내",
                    "영화제 / 야외상영",
                  ].map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              </label>
            ) : null}
            <label className="text-sm font-medium sm:col-span-2">
              메모
              <textarea
                name="note"
                rows={5}
                maxLength={5000}
                className={field}
                value={draft.note}
                onChange={(event) => change({ note: event.target.value })}
              />
            </label>
          </fieldset>
          <button
            disabled={busy}
            className={
              button +
              " bg-foreground text-background hover:bg-foreground hover:opacity-85"
            }
          >
            {busy ? "저장 중…" : "관람 기록 저장"}
          </button>
        </form>
      ) : null}
      {error ? (
        <div
          ref={errorBox}
          tabIndex={-1}
          role="alert"
          className="mt-5 space-y-3"
        >
          <p>{error}</p>
          <Link href={back} className="mr-4 underline">
            내 기록 확인
          </Link>
          <a href="/api/auth/google" className="underline">
            다시 로그인
          </a>
        </div>
      ) : null}
      {dirty ? (
        <div className="mt-6 border-t border-foreground/15 pt-4">
          <p role="status" className="text-xs text-foreground/70">
            {storageError
              ? "임시저장 불가. 화면을 떠나기 전 메모를 복사해 주세요."
              : "입력은 이 탭에서만 임시 보관돼요. 로그아웃하면 지워져요."}
          </p>
          <button
            disabled={busy}
            type="button"
            className={button + " mt-3"}
            onClick={() => {
              if (window.confirm("임시 기록을 버릴까요?")) {
                removeDraft();
                setDirty(false);
                router.push(back);
              }
            }}
          >
            임시 기록 버리기
          </button>
        </div>
      ) : null}
    </section>
  );
}
