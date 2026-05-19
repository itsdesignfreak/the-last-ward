import type { GridConfig } from '../engine/mapRenderer';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs font-mono">
        <span className="text-stone-400">{label}</span>
        <span className="text-amber-300 tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-amber-400 h-1 cursor-pointer"
      />
    </div>
  );
}

interface Props {
  config: GridConfig;
  savedConfig: GridConfig;
  onChange: (cfg: GridConfig) => void;
  onSave: () => void;
}

export function GridDebugPanel({ config, savedConfig, onChange, onSave }: Props) {
  const set = (key: keyof GridConfig) => (v: number) =>
    onChange({ ...config, [key]: v });

  return (
    <aside className="w-52 bg-stone-900 border-r border-stone-700 p-4 flex flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-widest text-amber-400">Grid Debug</h2>
        <div className="flex gap-1">
          <button
            onClick={onSave}
            className="text-xs text-amber-300 hover:text-white border border-amber-700 hover:border-amber-500 px-2 py-0.5 rounded"
          >
            Save
          </button>
          <button
            onClick={() => onChange(savedConfig)}
            className="text-xs text-stone-400 hover:text-white border border-stone-600 px-2 py-0.5 rounded"
          >
            Reset
          </button>
        </div>
      </div>

      <Slider label="Offset X"   value={config.offsetX}     min={-300} max={300}  step={1}   onChange={set('offsetX')} />
      <Slider label="Offset Y"   value={config.offsetY}     min={-300} max={300}  step={1}   onChange={set('offsetY')} />
      <Slider label="Tile W"     value={config.tileW}       min={40}   max={140}  step={1}   onChange={set('tileW')} />
      <Slider label="Tile H"     value={config.tileH}       min={40}   max={140}  step={1}   onChange={set('tileH')} />
      <Slider label="Tile Gap"   value={config.tileGap}     min={0}    max={20}   step={1}   onChange={set('tileGap')} />
      <Slider label="Tile Radius" value={config.tileRadius} min={0}    max={20}   step={1}   onChange={set('tileRadius')} />
      <Slider label="Rotate X°"  value={config.rotateXDeg}  min={0}    max={30}   step={0.5} onChange={set('rotateXDeg')} />
      <Slider label="Persp D"    value={config.perspD}      min={400}  max={3000} step={50}  onChange={set('perspD')} />
      <Slider label="Persp Max°" value={config.perspMaxDeg} min={0}    max={20}   step={0.5} onChange={set('perspMaxDeg')} />

      <div className="mt-1 pt-3 border-t border-stone-700">
        <p className="text-xs text-stone-500 mb-2">Copy into constants.ts:</p>
        <pre className="text-xs text-stone-300 bg-stone-800 p-2 rounded leading-5 overflow-x-auto select-all">{
`GRID_OFFSET_X = ${config.offsetX}
GRID_OFFSET_Y = ${config.offsetY}
TILE_W        = ${config.tileW}
TILE_H        = ${config.tileH}
TILE_GAP      = ${config.tileGap}
TILE_RADIUS   = ${config.tileRadius}
ROTATE_X_DEG  = ${config.rotateXDeg}
GRID_PERSP_D  = ${config.perspD}
PERSP_MAX_DEG = ${config.perspMaxDeg}`
        }</pre>
      </div>
    </aside>
  );
}
