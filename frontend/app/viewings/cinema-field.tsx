"use client";
import { useEffect, useId, useState } from "react";
import { api, button, cinemaLabel, field } from "./shared";
import type { Cinema } from "./shared";
export default function CinemaField({
  value,
  onChange,
}: {
  value: Cinema | null;
  onChange: (value: Cinema | null) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(value ? cinemaLabel(value) : "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Cinema[]>([]);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(id + "-" + active)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api<Cinema[]>(
        "/cinemas?q=" +
          encodeURIComponent(
            value && query === cinemaLabel(value) ? "" : query.trim(),
          ),
        undefined,
        controller.signal,
      )
        .then((items) => {
          if (!controller.signal.aborted) {
            setResults(items);
            setError("");
          }
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError("극장 검색 실패. 다시 입력해 주세요.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, value]);
  function select(cinema: Cinema) {
    onChange(cinema);
    setQuery(cinemaLabel(cinema));
    setOpen(false);
    setActive(-1);
  }
  return (
    <div
      className="relative min-w-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery(value ? cinemaLabel(value) : "");
        }
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        극장
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          name="cinemaQuery"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + "-list"}
          aria-activedescendant={
            open && active >= 0 ? id + "-" + active : undefined
          }
          value={query}
          className={field}
          autoComplete="off"
          maxLength={100}
          placeholder="극장 검색"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setResults([]);
            setActive(-1);
            setError("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                Math.max(
                  0,
                  Math.min(
                    results.length - 1,
                    index + (event.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (open && results[active]) select(results[active]);
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setQuery(value ? cinemaLabel(value) : "");
            }
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="극장 선택 해제"
            className={button + " mt-2 shrink-0"}
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(false);
            }}
          >
            해제
          </button>
        ) : null}
      </div>
      <div
        hidden={!open}
        className="absolute top-full z-10 mt-2 w-full rounded-xl border border-foreground/25 bg-background"
      >
        <ul
          id={id + "-list"}
          role="listbox"
          aria-label="극장 검색 결과"
          className="max-h-60 overflow-y-auto overscroll-contain rounded-xl"
        >
          {results.map((cinema, index) => (
            <li
              id={id + "-" + index}
              key={cinema.id}
              role="option"
              aria-selected={value?.id === cinema.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(cinema)}
              className={
                "cursor-pointer px-3 py-3 text-sm " +
                (active === index
                  ? "bg-foreground/10"
                  : "hover:bg-foreground/5")
              }
            >
              <p>{cinemaLabel(cinema)}</p>
              {cinema.address ? (
                <p className="mt-1 text-xs text-foreground/70">
                  {cinema.address}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        {open ? (
          <p role="status" className="px-3 text-sm">
            {error ||
              (loading
                ? "극장 검색 중…"
                : results.length === 0
                  ? "검색 결과가 없어요. 극장 없이 저장할 수 있어요."
                  : "")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
