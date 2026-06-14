import { type ReactNode, type CSSProperties } from "react";

interface LogoMarqueeProps {
  items: ReactNode[];
  durationSeconds?: number;
  reverse?: boolean;
  className?: string;
}

/**
 * An infinitely scrolling, seamless horizontal marquee. The items are rendered
 * twice and the track is translated by -50% so the loop has no visible seam.
 * Pauses on hover and respects prefers-reduced-motion (handled in index.css).
 *
 * Place on a `bg-background` surface so the edge fades blend correctly.
 */
export function LogoMarquee({
  items,
  durationSeconds = 40,
  reverse = false,
  className = "",
}: LogoMarqueeProps) {
  if (items.length === 0) return null;
  const sequence = [...items, ...items];

  return (
    <div className={`marquee-group relative overflow-hidden ${className}`}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 md:w-28 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 md:w-28 bg-gradient-to-l from-background to-transparent" />
      <div
        className="animate-marquee flex w-max items-center gap-4 py-1"
        style={
          {
            "--marquee-duration": `${durationSeconds}s`,
            animationDirection: reverse ? "reverse" : "normal",
          } as CSSProperties
        }
      >
        {sequence.map((item, i) => (
          <div key={i} className="shrink-0" aria-hidden={i >= items.length}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
