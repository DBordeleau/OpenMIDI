"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  arrangementTotalTicks,
  decodePatternSilhouette,
  FAMILY_COLORS,
  SILHOUETTE_BANDS,
  SILHOUETTE_COLUMNS,
  ticksPerBar,
  type ArrangementMapTrack,
} from "./arrangement-map";

const ROW_HEIGHT = 44;
const ROW_HEIGHT_COMPACT = 34;

/**
 * Where every clip sits, on every track. This is the one thing a project page
 * has that a streaming link does not — you can see the shape of the
 * arrangement before you commit to playing it.
 *
 * The silhouette inside each clip is texture, not notation: it is stretched
 * across the clip rather than windowed by `sourceStartTick`, because the
 * silhouette describes a whole pattern and the pattern's own length is not on
 * this payload. Clips are whole patterns in the overwhelming majority of
 * arrangements, so the two agree; where they don't, the density still reads
 * true even though an individual mark may not.
 */
export function ArrangementMap({
  tracks,
  timeSignature,
  silhouettes,
}: {
  tracks: ArrangementMapTrack[];
  timeSignature: { numerator: number; denominator: number } | null;
  silhouettes: Record<string, string | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 40rem)");
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rowHeight = compact ? ROW_HEIGHT_COMPACT : ROW_HEIGHT;
    const width = canvas.clientWidth;
    const height = rowHeight * tracks.length;
    if (width <= 0 || height <= 0) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const totalTicks = Math.max(arrangementTotalTicks(tracks), 1);
    const perBar = ticksPerBar(timeSignature);
    const bars = Math.max(Math.ceil(totalTicks / perBar), 1);
    const barWidth = width / bars;

    // A bar grid, with every fourth line lifted so phrases stay countable.
    for (let bar = 0; bar <= bars; bar += 1) {
      context.strokeStyle =
        bar % 4 === 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(Math.round(bar * barWidth) + 0.5, 0);
      context.lineTo(Math.round(bar * barWidth) + 0.5, height);
      context.stroke();
    }
    for (let index = 0; index < tracks.length; index += 1) {
      context.strokeStyle = "rgba(255,255,255,0.05)";
      context.beginPath();
      context.moveTo(0, Math.round(index * rowHeight) + 0.5);
      context.lineTo(width, Math.round(index * rowHeight) + 0.5);
      context.stroke();
    }

    tracks.forEach((track, index) => {
      const color = FAMILY_COLORS[track.family];
      for (const clip of track.clips) {
        const x = (clip.startTick / totalTicks) * width + 1.5;
        const clipWidth = Math.max(
          (clip.durationTicks / totalTicks) * width - 3,
          2,
        );
        const y = index * rowHeight + (compact ? 5 : 7);
        const clipHeight = rowHeight - (compact ? 10 : 14);

        const fill = context.createLinearGradient(x, y, x, y + clipHeight);
        fill.addColorStop(0, `${color}4d`);
        fill.addColorStop(1, `${color}1f`);
        context.fillStyle = fill;
        context.strokeStyle = `${color}88`;
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(x, y, clipWidth, clipHeight, compact ? 4 : 6);
        context.fill();
        context.stroke();

        const encoded = silhouettes[clip.midiPatternVersionId];
        const columns = encoded ? decodePatternSilhouette(encoded) : null;
        if (!columns) continue;

        const inset = 3;
        const usableWidth = clipWidth - inset * 2;
        const usableHeight = clipHeight - inset * 2;
        if (usableWidth <= 1 || usableHeight <= 2) continue;
        const columnWidth = usableWidth / SILHOUETTE_COLUMNS;
        const bandHeight = usableHeight / SILHOUETTE_BANDS;
        context.fillStyle = `${color}d0`;
        for (let column = 0; column < SILHOUETTE_COLUMNS; column += 1) {
          const bits = columns[column];
          if (!bits) continue;
          for (let band = 0; band < SILHOUETTE_BANDS; band += 1) {
            if (!(bits & (1 << band))) continue;
            // Band 0 is the lowest pitch, so it draws at the bottom.
            const bandY =
              y + inset + (SILHOUETTE_BANDS - 1 - band) * bandHeight;
            context.fillRect(
              x + inset + column * columnWidth,
              bandY,
              Math.max(columnWidth - 0.4, 0.6),
              Math.max(bandHeight - 0.8, 1),
            );
          }
        }
      }
    });
  }, [compact, silhouettes, timeSignature, tracks]);

  useEffect(() => {
    draw();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  const rowHeight = compact ? ROW_HEIGHT_COMPACT : ROW_HEIGHT;

  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)]">
      <ul className="grid">
        {tracks.map((track) => (
          <li
            key={track.id}
            style={{ height: `${rowHeight}px` }}
            className="grid content-center gap-0.5 border-b border-white/5 pr-3 first:border-t"
          >
            <span className="truncate text-[13px] font-semibold">
              {track.name}
            </span>
            <span className="text-muted hidden font-mono text-[10px] tracking-[0.1em] uppercase sm:block">
              {track.presetName}
            </span>
          </li>
        ))}
      </ul>
      <div className="min-w-0">
        <canvas ref={canvasRef} aria-hidden="true" className="block w-full" />
      </div>
    </div>
  );
}
