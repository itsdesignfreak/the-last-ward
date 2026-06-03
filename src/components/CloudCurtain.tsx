import { useEffect } from 'react';

interface Props {
  /** Fired once the clouds have fully scrolled off the top of the map. */
  onComplete: () => void;
}

const SPRITE = '/assets/ui/cloud-curtain.png';
const SCROLL_MS = 3000;

// The layer is a tall column (300% of canvas) of overlapping cloud sprites.
// Heavy overlap means the dense cloud bodies fill each other's thin/feathered
// gaps, so the whole map is covered by REAL clouds at the start (no flat fill).
const COPIES   = 9;
const COPY_H   = 36;   // each copy's height, % of the 300% column (~1.08× canvas)
const STEP     = 12;   // vertical gap between copies, % of the column

/** One parallax layer — a tall column of overlapping cloud sprites. */
function Layer({ anim, blur, opacity, z, widen }: {
  anim:    string;
  blur:    number;
  opacity: number;
  z:       number;
  widen:   number;   // extra width % for background depth (0 = exact)
}) {
  return (
    <div
      className="absolute bottom-0"
      style={{
        left:      `${-widen / 2}%`,
        width:     `${100 + widen}%`,
        height:    '300%',
        zIndex:    z,
        opacity,
        filter:    blur ? `blur(${blur}px)` : undefined,
        animation: `${anim} ${SCROLL_MS}ms linear forwards`,
        willChange: 'transform',
      }}
    >
      {Array.from({ length: COPIES }).map((_, i) => (
        <img
          key={i}
          src={SPRITE}
          alt=""
          draggable={false}
          className="absolute left-0 w-full object-cover"
          style={{
            height: `${COPY_H}%`,
            bottom: `${i * STEP}%`,
            // Alternate flips so repeated copies don't look identical
            transform: i % 2 ? 'scaleY(-1)' : undefined,
          }}
        />
      ))}
    </div>
  );
}

export function CloudCurtain({ onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, SCROLL_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 overflow-hidden z-20">
      {/* Background — slower (0.8x), softened + slightly wider for depth */}
      <Layer anim="cloudCurtainBg" blur={3} opacity={0.92} z={1} widen={12} />
      {/* Foreground — full speed (1x), sharp */}
      <Layer anim="cloudCurtainFg" blur={0} opacity={1}    z={2} widen={0} />
    </div>
  );
}
