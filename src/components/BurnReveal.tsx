import { useEffect, useRef } from 'react';
import {
  MAP_DITHERED_SRC, BURN_DURATION_MS, BURN_RIM_WIDTH, BURN_IRREGULAR,
} from '../constants';

interface Props {
  started: boolean;      // false = show dithered paper; true = play the burn
  onComplete: () => void;
}

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_paper;
uniform float u_t;          // burn threshold (sweeps from below 0 to above 1)
uniform float u_aspect;     // canvas width / height
uniform float u_rim;        // ember/char width
uniform float u_irregular;  // edge tear amplitude

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main(){
  vec2 uv = v_uv;

  // Radial distance from centre (aspect-corrected so the front is round).
  vec2 d = uv - 0.5; d.x *= u_aspect;
  float radial = length(d) / length(vec2(0.5 * u_aspect, 0.5));

  // Warp the front with multi-octave noise → fibrous, torn edge.
  float coarse = fbm(uv * 5.0);
  float fine   = fbm(uv * 17.0);
  float order  = radial + (coarse - 0.5) * 2.0 * u_irregular + (fine - 0.5) * u_irregular;

  float e = order - u_t;          // <0 burned away · ~0 the flame · >0 intact paper

  float CHAR  = u_rim;            // charring band just behind the flame
  float EMBER = u_rim * 0.7;      // glowing flame width
  float GLOW  = u_rim * 2.6;      // soft outer heat glow

  vec4 paper = texture2D(u_paper, uv);

  // Char: darken the paper to black ash as the flame approaches, then vanish.
  float charAmt = clamp(-e / CHAR, 0.0, 1.0);              // 0 at flame → 1 fully ash
  vec3 col = paper.rgb * (1.0 - charAmt * 0.92);
  float a = e > 0.0 ? 1.0 : clamp(1.0 + e / CHAR, 0.0, 1.0);

  // Ember: soft gaussian flame centred on the front (white-hot → orange).
  float emb = exp(-(e * e) / (EMBER * EMBER));
  float hot = smoothstep(EMBER, 0.0, abs(e));
  vec3 emberCol = mix(vec3(1.0, 0.33, 0.04), vec3(1.0, 0.93, 0.66), hot * 0.7);
  col = mix(col, emberCol, emb);
  a = max(a, emb);

  // Warm glow licking outward (adds light + a faint tint on the revealed side).
  float glow = exp(-(e * e) / (GLOW * GLOW));
  col += vec3(1.0, 0.42, 0.12) * glow * 0.45;
  if (e < 0.0) a = max(a, glow * 0.4);

  gl_FragColor = vec4(col, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error('Burn shader compile error:', gl.getShaderInfoLog(sh));
  }
  return sh;
}

export function BurnReveal({ started, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef     = useRef<WebGLRenderingContext | null>(null);
  const uTRef     = useRef<WebGLUniformLocation | null>(null);
  const readyRef  = useRef(false);
  const rafRef    = useRef(0);

  // Threshold sweep bounds (cover the noise-warped order range fully).
  const startT = -(BURN_IRREGULAR + BURN_RIM_WIDTH + 0.05);
  const endT   = 1 + BURN_IRREGULAR + BURN_RIM_WIDTH + 0.05;

  // ── Set up WebGL + texture once ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 1448; canvas.height = 1086;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true });
    if (!gl) { console.error('WebGL not available for burn reveal'); return; }
    glRef.current = gl;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uTRef.current = gl.getUniformLocation(prog, 'u_t');
    gl.uniform1f(gl.getUniformLocation(prog, 'u_aspect'), canvas.width / canvas.height);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_rim'), BURN_RIM_WIDTH);
    gl.uniform1f(gl.getUniformLocation(prog, 'u_irregular'), BURN_IRREGULAR);

    const draw = (t: number) => {
      gl.uniform1f(uTRef.current, t);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const img = new Image();
    img.src = MAP_DITHERED_SRC;
    img.onload = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      readyRef.current = true;
      (canvas as HTMLCanvasElement & { _draw?: (t: number) => void })._draw = draw;
      draw(startT); // full paper, nothing burned
    };

    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Run the burn when `started` flips true ──────────────────────────────────
  useEffect(() => {
    if (!started) return;
    const canvas = canvasRef.current as (HTMLCanvasElement & { _draw?: (t: number) => void }) | null;
    const startMs = performance.now();
    const span = endT - startT;
    const tick = (now: number) => {
      if (!readyRef.current || !canvas?._draw) { rafRef.current = requestAnimationFrame(tick); return; }
      const T = startT + ((now - startMs) / BURN_DURATION_MS) * span;
      if (T >= endT) { canvas._draw(endT); onComplete(); return; }
      canvas._draw(T);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-30 h-full w-full"
    />
  );
}
