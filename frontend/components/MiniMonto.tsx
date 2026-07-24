"use client";
/**
 * MiniMonto — a small companion bubble version of Monto3DAvatar for pages
 * that already have their own hero visual (exercise figure, dance emoji,
 * story cards, etc.) and just need Monto quietly present, not center-stage.
 * `speaking` should reflect real narration state where a page has one —
 * showing the talking mouth-flap animation with no audio playing looks broken.
 */
import { Monto3DAvatar } from "@/components/Monto3DAvatar";

export function MiniMonto({ speaking = false }: { speaking?: boolean }) {
  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-30 h-16 w-16 opacity-95 drop-shadow-[0_10px_24px_rgba(0,0,0,.4)] sm:h-20 sm:w-20"
      aria-hidden="true"
    >
      <Monto3DAvatar emotion={speaking ? "talking" : "happy"} size={80} />
    </div>
  );
}
