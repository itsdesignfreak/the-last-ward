import { useEffect } from 'react';

interface Props {
  /** Fired once the clouds have fully scrolled off the top of the map. */
  onComplete: () => void;
}

const SPRITE = '/assets/ui/cloud-curtain.png';
const SCROLL_MS = 3000;

/**
 * One parallax layer = two cloud sprites stacked vertically (200% canvas tall)
 * so coverage stays seamless as the curtain lifts. The top copy is flipped so
 * its dense edge meets the bottom copy's dense top (no seam).
 */
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
        height:    '200%',
        zIndex:    z,
        opacity,
        filter:    blur ? `blur(${blur}px)` : undefined,
        animation: `${anim} ${SCROLL_MS}ms linear forwards`,
        willChange: 'transform',
      }}
    >
      {/* Top copy — flipped vertically so the dense edge meets the seam */}
      <img
        src={SPRITE}
        alt=""
        className="block w-full h-1/2 object-cover"
        style={{ transform: 'scaleY(-1)' }}
        draggable={false}
      />
      {/* Bottom copy — covers the visible map; feathered edge at the bottom */}
      <img
        src={SPRITE}
        alt=""
        className="block w-full h-1/2 object-cover"
        draggable={false}
      />
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
