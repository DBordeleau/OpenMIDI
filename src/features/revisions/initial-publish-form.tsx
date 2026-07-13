"use client";
import { useActionState, useMemo, useState } from "react";
import { publishProjectAction, type PublishState } from "./actions";
import type { InstrumentOption, PublishAssetOption } from "./types";

type Selected = {
  trackId: string;
  assetId: string;
  name: string;
  instrumentId: string | null;
};
const bytes = (value: number) => `${(value / 1024 / 1024).toFixed(1)} MiB`;
export function InitialPublishForm({
  projectId,
  assets,
  instruments,
}: {
  projectId: string;
  assets: PublishAssetOption[];
  instruments: InstrumentOption[];
}) {
  const [selected, setSelected] = useState<Selected[]>([]);
  const [requestId] = useState(() => crypto.randomUUID());
  const action = useMemo(
    () => publishProjectAction.bind(null, projectId),
    [projectId],
  );
  const [state, formAction, pending] = useActionState<PublishState, FormData>(
    action,
    {},
  );
  const toggle = (asset: PublishAssetOption) =>
    setSelected((current) =>
      current.some((item) => item.assetId === asset.id)
        ? current.filter((item) => item.assetId !== asset.id)
        : current.length < 12
          ? [
              ...current,
              {
                trackId: crypto.randomUUID(),
                assetId: asset.id,
                name: asset.filename.replace(/\.[^.]+$/, ""),
                instrumentId: null,
              },
            ]
          : current,
    );
  const update = (index: number, patch: Partial<Selected>) =>
    setSelected((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const move = (index: number, delta: number) =>
    setSelected((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const total = selected.reduce(
    (sum, item) =>
      sum + (assets.find((asset) => asset.id === item.assetId)?.byteSize ?? 0),
    0,
  );
  return (
    <form action={formAction} className="mt-8 space-y-6">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="tracks" value={JSON.stringify(selected)} />
      <fieldset>
        <legend className="text-xl font-bold">Choose ready stems</legend>
        <p className="text-muted mt-1">
          {selected.length}/12 selected · {bytes(total)}
        </p>
        <div className="mt-4 grid gap-3">
          {assets.map((asset) => (
            <label
              key={asset.id}
              className="rounded-control border-subtle flex gap-3 border p-4"
            >
              <input
                type="checkbox"
                checked={selected.some((item) => item.assetId === asset.id)}
                onChange={() => toggle(asset)}
              />
              <span>
                <strong>{asset.filename}</strong>
                <span className="text-muted block text-sm">
                  {asset.creditName} · {bytes(asset.byteSize)} ·{" "}
                  {(asset.durationMs / 1000).toFixed(1)}s · {asset.mediaType} ·{" "}
                  {asset.channels}ch/{asset.sampleRateHz}Hz
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {selected.length > 0 && (
        <fieldset className="space-y-4">
          <legend className="text-xl font-bold">Order and label tracks</legend>
          {selected.map((item, index) => (
            <div
              className="rounded-control border-subtle grid gap-3 border p-4 sm:grid-cols-[1fr_1fr_auto]"
              key={item.assetId}
            >
              <label>
                Label
                <input
                  className="border-subtle mt-1 block min-h-11 w-full border px-3"
                  maxLength={120}
                  value={item.name}
                  onChange={(event) =>
                    update(index, { name: event.target.value })
                  }
                />
              </label>
              <label>
                Instrument
                <select
                  className="border-subtle mt-1 block min-h-11 w-full border px-3"
                  value={item.instrumentId ?? ""}
                  onChange={(event) =>
                    update(index, { instrumentId: event.target.value || null })
                  }
                >
                  <option value="">Not specified</option>
                  {instruments.map((instrument) => (
                    <option key={instrument.id} value={instrument.id}>
                      {instrument.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end gap-2">
                <button
                  className="border-strong min-h-11 border px-3"
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                >
                  Up
                </button>
                <button
                  className="border-strong min-h-11 border px-3"
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === selected.length - 1}
                >
                  Down
                </button>
              </div>
            </div>
          ))}
        </fieldset>
      )}
      <label className="block">
        Publish message (optional)
        <textarea
          className="border-subtle mt-1 block min-h-24 w-full border p-3"
          name="message"
          maxLength={500}
        />
      </label>
      {state.message && (
        <p role="alert" className="text-red-700">
          {state.message}
        </p>
      )}
      <button
        className="rounded-control bg-accent min-h-11 px-5 font-semibold text-slate-950 disabled:opacity-50"
        disabled={pending || selected.length === 0}
      >
        {pending ? "Publishing…" : "Publish first revision"}
      </button>
    </form>
  );
}
