import { BG_LANDSCAPE_SRC } from '../constants';

/**
 * Full-screen notice shown on small / mobile viewports. The Last Ward is a
 * desktop-first experience (it needs the room for the map + HUD), so on phones
 * we ask the player to switch to a larger screen instead of rendering the game.
 */
export function MobileNotice() {
  return (
    <div className="relative isolate flex h-screen flex-col items-center justify-center overflow-hidden bg-[#f0efea] px-8 text-center text-black font-ui">
      {/* Faint dithered horizon along the bottom — matches the start screen */}
      <img
        src={BG_LANDSCAPE_SRC}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 w-full select-none opacity-10"
      />

      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center rounded-full p-1.5"
          style={{
            backgroundColor: '#333',
            boxShadow: '0px 0px 0px 0.5px rgba(0,0,0,0.8), inset 0px 0px 0px 0.5px rgba(255,255,255,0.25)',
          }}
        >
          <img src="/assets/ui/icons/logo.svg" alt="" className="block size-4" draggable={false} />
        </span>
        <span className="font-medieval text-[18px] tracking-wide text-black">The Last Ward</span>
      </div>

      <h1 className="mt-8 font-medieval text-2xl uppercase tracking-[0.2em] text-black/80">
        Best Played on Desktop
      </h1>

      <p className="mt-4 max-w-xs text-sm leading-relaxed text-black/55">
        The Last Ward is built for a larger screen. For the full experience,
        please open it on a desktop or laptop.
      </p>
    </div>
  );
}
