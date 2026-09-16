"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  api,
  button,
  dateFormat,
  MovieInfo,
  RatingText,
  experience,
  returnPath,
  errorText,
} from "./shared";
import type { Viewing } from "./shared";
import RecordForm from "./record-form";
export default function RecordDetail({
  id,
  edit = false,
}: {
  id: string;
  edit?: boolean;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const back = returnPath(params.get("returnTo"));
  const [record, setRecord] = useState<Viewing | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Viewing>("/viewings/" + id, undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setRecord(value);
          setError("");
        }
      })
      .catch((caught) => {
        if (!controller.signal.aborted)
          setError(errorText(caught, "기록을 불러오지"));
      });
    return () => controller.abort();
  }, [id, edit, attempt]);
  async function remove() {
    if (
      lock.current ||
      !window.confirm(
        "이 관람 기록을 삭제할까요? 삭제한 기록은 복구할 수 없어요.",
      )
    )
      return;
    lock.current = true;
    setBusy(true);
    try {
      await api<void>("/viewings/" + id, undefined, undefined, "DELETE");
      router.replace(back);
    } catch (caught) {
      setError(errorText(caught, "삭제"));
      lock.current = false;
      setBusy(false);
    }
  }
  if (edit && record && record.id === id)
    return <RecordForm key={id} record={record} />;
  return (
    <section className="mx-auto max-w-2xl">
      <Link
        href={back}
        className="inline-flex min-h-12 items-center text-sm underline"
      >
        내 기록
      </Link>
      {error ? (
        <div role="alert" className="my-5">
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
      ) : null}
      {!record || record.id !== id ? (
        !error ? (
          <p role="status">기록 불러오는 중…</p>
        ) : null
      ) : (
        <>
          <h1 className="my-5 text-3xl font-semibold">관람 기록</h1>
          <MovieInfo movie={record.movie} />
          <div className="my-8 space-y-3 border-y border-foreground/15 py-6">
            <p className="tabular-nums">
              {dateFormat.format(new Date(record.watchedOn))}
              {record.watchedTime ? " · " + record.watchedTime : ""}
            </p>
            <p>
              <RatingText value={record.ratingHalfStars} />
            </p>
            {experience(record) ? (
              <p className="break-words text-sm">{experience(record)}</p>
            ) : null}
          </div>
          {record.note ? (
            <p className="whitespace-pre-wrap break-words leading-7">
              {record.note}
            </p>
          ) : (
            <p className="text-foreground/65">남긴 메모가 없어요.</p>
          )}
          <div className="mt-8 flex gap-3">
            <Link
              href={
                "/viewings/" + id + "/edit?returnTo=" + encodeURIComponent(back)
              }
              className={button}
            >
              수정
            </Link>
            <button
              disabled={busy}
              className={button}
              onClick={() => void remove()}
            >
              {busy ? "삭제 중…" : "삭제"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
