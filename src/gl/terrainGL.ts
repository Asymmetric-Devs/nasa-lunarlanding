import * as THREE from 'three'
import type { PolarGrid } from '../engine/terrain'

const R_MOON = 1737.4
const NODATA_KM = -40

/** Int16 metres -> half-float km texture (via a 64k lookup table; ~100x faster than per-sample conversion). */
function toTexture(g: PolarGrid) {
  const lut = new Uint16Array(65536)
  for (let v = -32768; v < 32768; v++) lut[v + 32768] = THREE.DataUtils.toHalfFloat(v === g.nodata ? NODATA_KM : v / 1000)
  const out = new Uint16Array(g.n * g.n), src = g.data
  for (let i = 0; i < out.length; i++) out[i] = lut[src[i] + 32768]
  const t = new THREE.DataTexture(out, g.n, g.n, THREE.RedFormat, THREE.HalfFloatType)
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true
  return t
}

const HEIGHT_GLSL = /* glsl */ `
uniform sampler2D uTile; uniform vec4 uTileP; uniform float uHasTile;
uniform sampler2D uCore; uniform vec4 uCoreP;   // centre col/row (texel coords of the pole), n, res_m
uniform sampler2D uCap;  uniform vec4 uCapP; uniform float uHasCap;
float H(vec2 xy, out float valid) {
  valid = 0.0;
  if (uHasTile > 0.5) {
    vec2 uv0 = (uTileP.xy + xy * 1000.0 / uTileP.w + 0.5) / uTileP.z;
    if (uv0.x > 0.0 && uv0.y > 0.0 && uv0.x < 1.0 && uv0.y < 1.0) { float h = textureLod(uTile, uv0, 0.0).r; if (h > -30.0) { valid = 1.0; return h; } }
  }
  vec2 uv = (uCoreP.xy + xy * 1000.0 / uCoreP.w + 0.5) / uCoreP.z;
  if (uv.x > 0.0 && uv.y > 0.0 && uv.x < 1.0 && uv.y < 1.0) { float h = textureLod(uCore, uv, 0.0).r; if (h > -30.0) { valid = 1.0; return h; } }
  if (uHasCap > 0.5) {
    vec2 uv2 = (uCapP.xy + xy * 1000.0 / uCapP.w + 0.5) / uCapP.z;
    if (uv2.x > 0.0 && uv2.y > 0.0 && uv2.x < 1.0 && uv2.y < 1.0) { float h = textureLod(uCap, uv2, 0.0).r; if (h > -30.0) { valid = 1.0; return h; } }
  }
  return 0.0;
}`

const VERT = /* glsl */ `
uniform vec4 uView;   // centre xy (km), mesh half-size (km), vertical exaggeration
varying vec2 vXY; varying float vValid;
${HEIGHT_GLSL}
void main() {
  vec2 xy = uView.xy + position.xy * uView.z;
  float v = 1.0; float z = 0.0;
  if (uView.w > 0.0) { float h = H(xy, v); z = h * uView.w * v; }
  vXY = xy; vValid = v;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(xy.x, -xy.y, z, 1.0);
}`

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSun;        // unit vector to the Sun, Moon-fixed frame
uniform vec3 uIll;        // illustrative mode: map-frame direction xy + local elevation (rad)
uniform float uMode;      // 0 physical, 1 illustrative
uniform float uSteps;
uniform vec4 uCont;       // contour interval (km), strength, line width (px), index-line strength
uniform vec3 uLineCol; uniform vec3 uBg;
uniform vec3 uMarker;     // site xy (km), on/off
uniform float uShadows; uniform float uExposure;
varying vec2 vXY; varying float vValid;
const float R = 1737.4;
${HEIGHT_GLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main() {
  vec2 xy = vXY; float valid; float h0 = H(xy, valid);
  if (valid < 0.5) discard;
  float rho = length(xy);
  float lat = -1.5707963 + 2.0 * atan(rho / (2.0 * R)); float lon = rho > 1e-6 ? atan(xy.x, -xy.y) : 0.0;
  float cl = cos(lat), sl = sin(lat), co = cos(lon), so = sin(lon);
  vec3 up = vec3(cl * co, cl * so, sl), east = vec3(-so, co, 0.0), north = vec3(-sl * co, -sl * so, cl);
  float el = asin(clamp(dot(uSun, up), -1.0, 1.0)); float az = atan(dot(uSun, east), dot(uSun, north));
  vec2 dir = vec2(sin(lon + az), -cos(lon + az));
  if (uMode > 0.5) { dir = uIll.xy; el = uIll.z; }
  float d = uCoreP.w / 1000.0; float vv;
  float hl = H(xy - vec2(d, 0.0), vv), hr = H(xy + vec2(d, 0.0), vv), hu = H(xy - vec2(0.0, d), vv), hd = H(xy + vec2(0.0, d), vv);
  vec2 g = vec2(hr - hl, hd - hu) / (2.0 * d);
  float ce = cos(el), se = sin(el);
  float lam = max(0.0, (-g.x * dir.x * ce - g.y * dir.y * ce + se) / length(vec3(g, 1.0)));
  float lit = el > -0.003 ? 1.0 : 0.0;
  if (lit > 0.5 && uShadows > 0.5) {
    float tanE = tan(el), s = d * 1.5;
    float mul = exp(log(70.0 / s) / max(1.0, uSteps));
    for (int i = 0; i < 170; i++) {
      if (float(i) >= uSteps || s > 70.0) break;
      float hv; float hh = H(xy + dir * s, hv);
      if (hv > 0.5 && (hh - h0) / s - s / (2.0 * R) > tanE + 0.0004) { lit = 0.0; break; }
      s *= mul;
    }
  }
  float amb = 0.035 + 0.045 * clamp((h0 + 4.0) / 8.0, 0.0, 1.0);
  float b = lit > 0.5 ? min(1.0, amb + 0.95 * lam * uExposure * (0.25 + 0.75 * min(1.0, el * 12.0 + 0.3))) : amb;
  vec3 col = vec3(0.012, 0.016, 0.026) + b * (lit > 0.5 ? vec3(0.94, 0.88, 0.76) : vec3(0.42, 0.48, 0.62));
  col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
  if (uCont.y > 0.0) {
    float c = h0 / uCont.x; float fw = max(fwidth(c), 1e-5);
    float line = 1.0 - clamp(abs(fract(c - 0.5) - 0.5) / fw / uCont.z, 0.0, 1.0);
    float c5 = h0 / (uCont.x * 5.0); float fw5 = max(fwidth(c5), 1e-5);
    float idx = 1.0 - clamp(abs(fract(c5 - 0.5) - 0.5) / fw5 / (uCont.z * 1.8), 0.0, 1.0);
    col = mix(col, uLineCol, clamp(line * uCont.y + idx * uCont.w, 0.0, 1.0));
  }
  if (uMarker.z > 0.5) {
    float px = max(length(fwidth(xy)), 1e-5); float dm = length(xy - uMarker.xy) / px;
    float ring = (1.0 - smoothstep(0.0, 1.3, abs(dm - 9.0))) + (1.0 - smoothstep(0.0, 1.2, abs(dm - 2.5)));
    col = mix(col, vec3(1.0), clamp(ring, 0.0, 1.0));
  }
  gl_FragColor = vec4(col, 1.0);
}`

export interface View { cx: number; cy: number; radius: number; tilt: number; exag: number }
export interface Look { exposure: number; contour: number; contourStrength: number; indexStrength: number; lineColor: [number, number, number]; shadows: boolean; steps: number }

export class TerrainGL {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(32, 1, 0.5, 5000)
  mat: THREE.ShaderMaterial
  mesh: THREE.Mesh
  private flatGeo: THREE.PlaneGeometry
  private reliefGeo: THREE.PlaneGeometry
  w = 1; h = 1
  scale = 1; maxScale = 1; software = false; lost = false
  onRestore?: () => void
  private slow = 0; private fast = 0; private baseSteps = 150; private stepScale = 1
  private textures: THREE.DataTexture[] = []
  private tileTex: THREE.DataTexture | null = null
  private dummy = new THREE.DataTexture(new Uint16Array([0]), 1, 1, THREE.RedFormat, THREE.HalfFloatType)
  private onLost: (e: Event) => void
  private onRestored: () => void

  private static _supported: boolean | null = null
  static supported() {
    if (this._supported !== null) return this._supported
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2')
      const ok = !!gl
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      return (this._supported = ok)
    } catch { return (this._supported = false) }
  }

  constructor(canvas: HTMLCanvasElement, bg = [0.012, 0.016, 0.026]) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true })
    this.renderer.setClearColor(new THREE.Color(bg[0], bg[1], bg[2]), 1)
    this.dummy.needsUpdate = true
    try { const gl = this.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info'); const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : ''; this.software = /swiftshader|llvmpipe|software/i.test(name) } catch { /* ignore */ }
    if (this.software) { this.scale = 0.5; this.maxScale = 0.65 }
    const q = Number(new URLSearchParams(location.search).get('q')); if (q > 0) { this.scale = q; this.maxScale = q } // test override: ?q=0.8
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide,
      uniforms: {
        uTile: { value: this.dummy }, uTileP: { value: new THREE.Vector4(0, 0, 1, 80) }, uHasTile: { value: 0 },
        uCore: { value: this.dummy }, uCoreP: { value: new THREE.Vector4(0, 0, 1, 80) }, uCap: { value: this.dummy }, uCapP: { value: new THREE.Vector4(0, 0, 1, 240) }, uHasCap: { value: 0 },
        uView: { value: new THREE.Vector4(0, 0, 100, 1) }, uSun: { value: new THREE.Vector3(1, 0, 0.03).normalize() }, uIll: { value: new THREE.Vector3(1, 0, 0.03) }, uMode: { value: 0 }, uSteps: { value: 150 },
        uCont: { value: new THREE.Vector4(0.25, 0, 1.1, 0) }, uLineCol: { value: new THREE.Vector3(1, 0.62, 0.2) }, uBg: { value: new THREE.Vector3(...bg) }, uMarker: { value: new THREE.Vector3(0, 0, 0) }, uShadows: { value: 1 }, uExposure: { value: 1 },
      },
    })
    const seg = this.software ? 128 : 220
    this.flatGeo = new THREE.PlaneGeometry(2, 2, 1, 1)
    this.reliefGeo = new THREE.PlaneGeometry(2, 2, seg, seg)
    this.mesh = new THREE.Mesh(this.reliefGeo, this.mat); this.mesh.frustumCulled = false; this.scene.add(this.mesh)
    this.onLost = (e: Event) => { e.preventDefault(); this.lost = true }
    this.onRestored = () => {
      this.lost = false
      for (const t of this.textures) t.needsUpdate = true
      if (this.tileTex) this.tileTex.needsUpdate = true
      this.dummy.needsUpdate = true
      this.mat.needsUpdate = true
      this.render()
      this.onRestore?.()
    }
    canvas.addEventListener('webglcontextlost', this.onLost)
    canvas.addEventListener('webglcontextrestored', this.onRestored)
  }

  setTerrain(core: PolarGrid, cap?: PolarGrid | null) {
    const u = this.mat.uniforms
    const tc = toTexture(core); this.textures.push(tc); u.uCore.value = tc
    u.uCoreP.value.set(core.c - (core.x0 ?? 0), core.c - (core.y0 ?? 0), core.n, core.res_m)
    if (cap) { const tp = toTexture(cap); this.textures.push(tp); u.uCap.value = tp; u.uCapP.value.set(cap.c - (cap.x0 ?? 0), cap.c - (cap.y0 ?? 0), cap.n, cap.res_m); u.uHasCap.value = 1 }
  }

  /** Upload or clear the optional 80 m fine site tile (takes precedence over core80 and polar240). */
  setTile(tile?: PolarGrid | null) {
    const u = this.mat.uniforms
    if (this.tileTex) { this.tileTex.dispose(); this.tileTex = null }
    if (tile) {
      const tt = toTexture(tile); this.tileTex = tt; u.uTile.value = tt
      u.uTileP.value.set(tile.c - (tile.x0 ?? 0), tile.c - (tile.y0 ?? 0), tile.n, tile.res_m)
      u.uHasTile.value = 1
    } else {
      u.uTile.value = this.dummy; u.uHasTile.value = 0
    }
  }

  dprBase = 1
  resize(w: number, h: number, dpr: number) { if (w === this.w && h === this.h && dpr === this.dprBase) return; this.w = w; this.h = h; this.dprBase = dpr; this.apply() }
  private apply() { this.renderer.setPixelRatio(this.dprBase * this.scale); this.renderer.setSize(this.w, this.h, false); this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix() }
  /** Adaptive ray-march steps and resolution: shed shader cost before resizing the canvas buffer. */
  adapt(dtMs: number) {
    if (dtMs > 120) { this.slow += 3; this.fast = 0 }
    else if (dtMs > 38) { this.slow++; this.fast = 0 }
    else if (dtMs < 19) { this.fast++; this.slow = 0 }
    else { this.slow = 0; this.fast = 0 }

    if (this.slow >= 6 && (this.stepScale > 0.35 || this.scale > 0.55)) {
      this.stepScale = Math.max(0.35, this.stepScale * 0.75)
      this.mat.uniforms.uSteps.value = Math.round(this.baseSteps * this.stepScale)
      if (this.stepScale <= 0.5 && this.scale > 0.55) {
        this.scale = Math.max(0.55, this.scale * 0.85)
        this.apply()
      }
      this.slow = 0
    } else if (this.fast >= 90 && (this.scale < this.maxScale || this.stepScale < 1)) {
      const nextScale = Math.min(this.maxScale, this.scale * 1.15)
      const resized = nextScale !== this.scale
      this.scale = nextScale
      this.stepScale = Math.min(1, this.stepScale * 1.15)
      this.mat.uniforms.uSteps.value = Math.round(this.baseSteps * this.stepScale)
      this.fast = 0
      if (resized) this.apply()
    }
  }

  setLook(l: Partial<Look>) {
    const u = this.mat.uniforms
    if (l.exposure !== undefined) u.uExposure.value = l.exposure
    if (l.contour !== undefined) u.uCont.value.x = l.contour
    if (l.contourStrength !== undefined) u.uCont.value.y = l.contourStrength
    if (l.indexStrength !== undefined) u.uCont.value.w = l.indexStrength
    if (l.lineColor) u.uLineCol.value.set(...l.lineColor)
    if (l.shadows !== undefined) u.uShadows.value = l.shadows ? 1 : 0
    if (l.steps !== undefined) { this.baseSteps = l.steps; u.uSteps.value = Math.round(this.baseSteps * this.stepScale) }
  }
  /** Physical Sun: unit vector in the Moon-fixed frame. */
  setSunPhysical(v: [number, number, number]) { this.mat.uniforms.uMode.value = 0; this.mat.uniforms.uSun.value.set(...v) }
  /** Illustrative Sun: screen direction (dx, dy down) and constant local elevation (rad). */
  setSunIllustrative(dx: number, dy: number, el: number) { const l = Math.hypot(dx, dy) || 1; this.mat.uniforms.uMode.value = 1; this.mat.uniforms.uIll.value.set(dx / l, dy / l, el) }
  setMarker(x: number, y: number, on: boolean) { this.mat.uniforms.uMarker.value.set(x, y, on ? 1 : 0) }

  setView(v: View) {
    this.mesh.geometry = v.exag > 0 ? this.reliefGeo : this.flatGeo
    const fov = (this.camera.fov * Math.PI) / 180, D = v.radius / Math.tan(fov / 2), t = (v.tilt * Math.PI) / 180
    this.mat.uniforms.uView.value.set(v.cx, v.cy, v.radius * Math.max(1, this.camera.aspect) * (1.12 + 1.35 * Math.sin(t)), v.exag)
    const target = new THREE.Vector3(v.cx, -v.cy, 0)
    this.camera.position.set(target.x, target.y - Math.sin(t) * D, Math.cos(t) * D)
    this.camera.up.set(0, 1, 0); this.camera.near = D * 0.02; this.camera.far = D * 8; this.camera.updateProjectionMatrix()
    this.camera.lookAt(target)
  }

  render() { if (!this.lost) this.renderer.render(this.scene, this.camera) }
  dispose() {
    const cv = this.renderer.domElement
    cv.removeEventListener('webglcontextlost', this.onLost)
    cv.removeEventListener('webglcontextrestored', this.onRestored)
    this.tileTex?.dispose(); this.textures.forEach((t) => t.dispose()); this.dummy.dispose()
    this.flatGeo.dispose(); this.reliefGeo.dispose(); this.mat.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss()
  }
}

export { R_MOON }
