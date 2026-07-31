"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ImageOff,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

/** Pan is stored in crop-box widths so it survives a differently sized box. */
export type CropTransform = {
  zoom: number;
  nx: number;
  ny: number;
  /** 0 | 90 | 180 | 270 */
  rotation: number;
};

export const DEFAULT_CROP: CropTransform = {
  zoom: 1,
  nx: 0,
  ny: 0,
  rotation: 0,
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
/** Crop circle diameter as a share of the viewport — the rest is the dimmed
 *  margin that shows what is being cut off. Must match `inset-[8%]` below. */
const CROP_RATIO = 0.84;
/** Longest edge of the export. Capped, and never upscaled past the source. */
const MAX_OUTPUT = 512;
const MIN_OUTPUT = 128;

type Size = { w: number; h: number };

type Geometry = {
  /** Pre-rotation on-screen size of the <img> element. */
  elW: number;
  elH: number;
  /** Post-rotation bounding box on screen. */
  boxW: number;
  boxH: number;
  /** natural px → screen px. */
  scale: number;
  quarter: number;
};

/**
 * Cover-fit the image to the square crop box, then apply the user's zoom.
 * At quarter turns natural width/height swap, so the fit is recomputed from
 * the rotated aspect ratio — turning a landscape photo keeps it filling the
 * circle instead of leaving gaps.
 */
function geometry(
  nat: Size,
  rotation: number,
  zoom: number,
  crop: number
): Geometry {
  const quarter = ((rotation % 360) + 360) % 360;
  const swapped = quarter === 90 || quarter === 270;
  const rotW = swapped ? nat.h : nat.w;
  const rotH = swapped ? nat.w : nat.h;
  const scale = (crop / Math.min(rotW, rotH)) * zoom;
  return {
    elW: nat.w * scale,
    elH: nat.h * scale,
    boxW: rotW * scale,
    boxH: rotH * scale,
    scale,
    quarter,
  };
}

/** Keep the image covering the crop circle — no empty edges, ever. */
function clampPan(g: Geometry, crop: number, x: number, y: number) {
  const maxX = Math.max(0, (g.boxW - crop) / 2);
  const maxY = Math.max(0, (g.boxH - crop) / 2);
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y)),
  };
}

export function AvatarCropper({
  src,
  open,
  onOpenChange,
  onConfirm,
  initial,
  title = "Adjust your photo",
}: {
  src: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (blob: Blob, transform: CropTransform) => Promise<void> | void;
  initial?: CropTransform | null;
  title?: string;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (saving) return; // never orphan an in-flight upload
        setSaving(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1.5rem)] gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-md">
        <DialogHeader className="px-4 pt-4 pb-3 sm:px-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Drag to reposition · pinch or scroll to zoom
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so every open — and every new image — starts from a clean
            transform without a reset effect. */}
        <CropperBody
          key={`${open}:${src ?? ""}`}
          src={src}
          initial={initial}
          saving={saving}
          setSaving={setSaving}
          onConfirm={onConfirm}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CropperBody({
  src,
  initial,
  saving,
  setSaving,
  onConfirm,
  onCancel,
}: {
  src: string | null;
  initial?: CropTransform | null;
  saving: boolean;
  setSaving: (v: boolean) => void;
  onConfirm: (blob: Blob, transform: CropTransform) => Promise<void> | void;
  onCancel: () => void;
}) {
  const start = initial ?? DEFAULT_CROP;

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [vp, setVp] = useState(0); // measured viewport side, px
  const [nat, setNat] = useState<Size | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false); // mid-gesture → show guides

  const [zoom, setZoom] = useState(start.zoom);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(start.rotation);

  const crop = vp * CROP_RATIO;

  // Live pointer bookkeeping for drag + pinch. Refs, not state: these change
  // many times per frame and must not each trigger a render.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(
    null
  );
  // Pending transform, read/written synchronously during a gesture so events
  // landing in the same frame compose instead of racing stale state.
  const live = useRef({ zoom: start.zoom, x: 0, y: 0, rotation: start.rotation });
  // Latest measurements, readable from callbacks that fire out of order.
  const natRef = useRef<Size | null>(null);
  const vpRef = useRef(0);
  const restored = useRef(false);

  const commit = useCallback(() => {
    setZoom(live.current.zoom);
    setPan({ x: live.current.x, y: live.current.y });
    setRotation(live.current.rotation);
  }, []);

  /** Re-apply a saved pan once both the image and the box are measured.
   *  Called from the resize observer and the image's load handler — whichever
   *  finishes last does the work. */
  const restorePan = useCallback(() => {
    const n = natRef.current;
    const size = vpRef.current * CROP_RATIO;
    if (restored.current || !initial || !n || !size) return;
    restored.current = true;
    const g = geometry(n, initial.rotation, initial.zoom, size);
    const p = clampPan(g, size, initial.nx * size, initial.ny * size);
    live.current = { ...live.current, x: p.x, y: p.y };
    setPan(p);
  }, [initial]);

  // The viewport is fluid (vw- and dvh-capped), so remeasure on device
  // rotation, on-screen keyboards and desktop window drags alike.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      const prev = vpRef.current;
      if (next === prev) return;
      if (prev > 0 && next > 0) {
        // Keep the framing when the box itself changes size.
        const k = next / prev;
        live.current.x *= k;
        live.current.y *= k;
        setPan({ x: live.current.x, y: live.current.y });
      }
      vpRef.current = next;
      setVp(next);
      restorePan();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [restorePan]);

  const g = nat && crop ? geometry(nat, rotation, zoom, crop) : null;

  /** Zoom about a point in viewport coordinates (top-left origin). */
  const zoomAround = useCallback(
    (nextZoom: number, px: number, py: number) => {
      if (!nat || !crop) return;
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const k = z / live.current.zoom;
      if (k === 1) return;
      // Keep whatever sits under the cursor / pinch centre pinned in place.
      const cx = px - vp / 2;
      const cy = py - vp / 2;
      const x = live.current.x * k + cx * (1 - k);
      const y = live.current.y * k + cy * (1 - k);
      const geo = geometry(nat, live.current.rotation, z, crop);
      const p = clampPan(geo, crop, x, y);
      live.current = { ...live.current, zoom: z, x: p.x, y: p.y };
      commit();
    },
    [nat, crop, vp, commit]
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      if (!nat || !crop) return;
      const geo = geometry(nat, live.current.rotation, live.current.zoom, crop);
      const p = clampPan(geo, crop, live.current.x + dx, live.current.y + dy);
      live.current = { ...live.current, x: p.x, y: p.y };
      commit();
    },
    [nat, crop, commit]
  );

  function localPoint(e: { clientX: number; clientY: number }) {
    const r = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startPinch() {
    const [a, b] = [...pointers.current.values()];
    pinch.current = {
      dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!nat) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, localPoint(e));
    setActive(true);
    if (pointers.current.size === 2) startPinch();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId) || !nat) return;
    const prev = pointers.current.get(e.pointerId)!;
    const now = localPoint(e);
    pointers.current.set(e.pointerId, now);

    if (pointers.current.size === 1) {
      panBy(now.x - prev.x, now.y - prev.y);
      return;
    }
    if (pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Two fingers pan and zoom together: translate by the midpoint delta,
      // then scale about the new midpoint.
      panBy(mid.x - pinch.current.mid.x, mid.y - pinch.current.mid.y);
      zoomAround(live.current.zoom * (dist / pinch.current.dist), mid.x, mid.y);
      pinch.current = { dist, mid };
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 2) startPinch();
    else pinch.current = null;
    if (pointers.current.size === 0) setActive(false);
  }

  // Wheel needs a non-passive native listener: React's onWheel is passive, so
  // preventDefault there is ignored and the dialog scrolls behind the gesture.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !nat) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAround(
        live.current.zoom * Math.exp(-e.deltaY * 0.0022),
        e.clientX - r.left,
        e.clientY - r.top
      );
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [nat, zoomAround]);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 24 : 8;
    const c = vp / 2;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => panBy(step, 0),
      ArrowRight: () => panBy(-step, 0),
      ArrowUp: () => panBy(0, step),
      ArrowDown: () => panBy(0, -step),
      "+": () => zoomAround(live.current.zoom + 0.2, c, c),
      "=": () => zoomAround(live.current.zoom + 0.2, c, c),
      "-": () => zoomAround(live.current.zoom - 0.2, c, c),
      _: () => zoomAround(live.current.zoom - 0.2, c, c),
    };
    const fn = actions[e.key];
    if (!fn) return;
    e.preventDefault();
    fn();
  }

  function rotate(dir: 1 | -1) {
    if (!nat || !crop) return;
    const next = live.current.rotation + dir * 90;
    // Turn the pan vector with the picture so the framing follows it.
    const { x, y } = live.current;
    const rx = dir === 1 ? -y : y;
    const ry = dir === 1 ? x : -x;
    const geo = geometry(nat, next, live.current.zoom, crop);
    const p = clampPan(geo, crop, rx, ry);
    live.current = { ...live.current, rotation: next, x: p.x, y: p.y };
    commit();
  }

  function reset() {
    live.current = { zoom: 1, x: 0, y: 0, rotation: 0 };
    commit();
  }

  async function handleSave() {
    const img = imgRef.current;
    if (!img || !nat || !crop || !g) return;
    setError(null);
    setSaving(true);
    try {
      // Export at the source's own resolution for this crop, capped — never
      // upscale, never ship a needlessly large file.
      const out = Math.round(
        Math.min(MAX_OUTPUT, Math.max(MIN_OUTPUT, crop / g.scale))
      );
      const canvas = document.createElement("canvas");
      canvas.width = out;
      canvas.height = out;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser.");
      ctx.imageSmoothingQuality = "high";

      // Same transform as on screen, rescaled from crop-box px to output px.
      const k = out / crop;
      ctx.translate(out / 2 + pan.x * k, out / 2 + pan.y * k);
      ctx.rotate((g.quarter * Math.PI) / 180);
      ctx.drawImage(
        img,
        (-g.elW * k) / 2,
        (-g.elH * k) / 2,
        g.elW * k,
        g.elH * k
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", 0.92)
      );
      if (!blob) throw new Error("Could not render the cropped image.");

      await onConfirm(blob, {
        zoom,
        nx: pan.x / crop,
        ny: pan.y / crop,
        rotation: g.quarter,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong saving the photo."
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  const imgStyle: React.CSSProperties = g
    ? {
        width: g.elW,
        height: g.elH,
        transform: `translate(${vp / 2 - g.elW / 2 + pan.x}px, ${
          vp / 2 - g.elH / 2 + pan.y
        }px) rotate(${g.quarter}deg)`,
      }
    : { opacity: 0 };

  const busy = saving;

  return (
    <>
      <div className="px-4 sm:px-5">
        {/* Square stage, capped by height too so it still fits a landscape
            phone or a short desktop window. */}
        <div
          className="mx-auto w-full"
          style={{ maxWidth: "min(20rem, 46dvh)" }}
        >
          <div
            ref={viewportRef}
            role="application"
            aria-label="Photo crop area. Arrow keys reposition, plus and minus zoom."
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            className={cn(
              "relative aspect-square w-full touch-none overflow-hidden rounded-2xl bg-muted select-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              nat ? "cursor-grab active:cursor-grabbing" : "cursor-default"
            )}
          >
            {src && !loadError && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={imgRef}
                src={src}
                alt=""
                draggable={false}
                // Needed so the canvas export is not tainted when the source
                // is a Supabase Storage URL rather than a local object URL.
                crossOrigin="anonymous"
                onLoad={(e) => {
                  const size = {
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  };
                  natRef.current = size;
                  setNat(size);
                  restorePan();
                }}
                onError={() => setLoadError(true)}
                className="absolute top-0 left-0 max-w-none origin-center"
                style={imgStyle}
              />
            )}

            {/* Dim everything outside the crop circle. A radial gradient, not
                a 9999px box-shadow: the shadow rasterises to a layer far
                larger than the screen next to the composited image and stalls
                paint on low-memory devices. 42% radius == inset-[8%]. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(ellipse 42% 42% at 50% 50%, rgba(0,0,0,0) 99%, rgba(0,0,0,0.55) 100%)",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-[8%] rounded-full ring-1 ring-white/70"
            />
            {/* Rule-of-thirds guides, only while a gesture is in flight. */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-[8%] rounded-full opacity-0 transition-opacity duration-150",
                active && "opacity-100"
              )}
              style={{
                backgroundImage: [
                  "linear-gradient(to right, transparent calc(33.33% - 0.5px), rgba(255,255,255,.35) calc(33.33% - 0.5px), rgba(255,255,255,.35) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,.35) calc(66.66% - 0.5px), rgba(255,255,255,.35) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))",
                  "linear-gradient(to bottom, transparent calc(33.33% - 0.5px), rgba(255,255,255,.35) calc(33.33% - 0.5px), rgba(255,255,255,.35) calc(33.33% + 0.5px), transparent calc(33.33% + 0.5px), transparent calc(66.66% - 0.5px), rgba(255,255,255,.35) calc(66.66% - 0.5px), rgba(255,255,255,.35) calc(66.66% + 0.5px), transparent calc(66.66% + 0.5px))",
                ].join(", "),
              }}
            />

            {!nat && !loadError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-white/80" />
              </div>
            )}
            {loadError && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted px-6 text-center">
                <ImageOff className="size-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  That image could not be loaded. Try picking another one.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Zoom row — icon buttons flank the slider so it is usable with a
            thumb on mobile and a cursor on desktop. */}
        <div className="mt-4 flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!nat || busy || zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            onClick={() => zoomAround(zoom - 0.25, vp / 2, vp / 2)}
          >
            <Minus />
          </Button>
          <Slider
            value={[zoom]}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            disabled={!nat || busy}
            aria-label="Zoom"
            onValueChange={([v]) => zoomAround(v, vp / 2, vp / 2)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!nat || busy || zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            onClick={() => zoomAround(zoom + 0.25, vp / 2, vp / 2)}
          >
            <Plus />
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!nat || busy}
            onClick={() => rotate(-1)}
          >
            <RotateCcw />
            Left
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!nat || busy}
            onClick={() => rotate(1)}
          >
            <RotateCw />
            Right
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!nat || busy}
            onClick={reset}
            className="text-muted-foreground"
          >
            Reset
          </Button>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {/* Stacked full-width actions on phones, right-aligned on desktop. */}
      <div className="mt-4 flex flex-col-reverse gap-2 border-t bg-muted/40 p-4 sm:flex-row sm:justify-end sm:px-5">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={!nat || loadError || busy}
          onClick={handleSave}
        >
          {busy && <Loader2 className="animate-spin" />}
          {busy ? "Saving…" : "Save photo"}
        </Button>
      </div>
    </>
  );
}
