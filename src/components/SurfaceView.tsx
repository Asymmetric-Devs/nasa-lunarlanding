import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import * as Astronomy from 'astronomy-engine'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Result } from '../hooks/useAnalysis'
import type { Sample } from '../engine/analysis'
import { destination } from '../engine/terrain'
import { MOON_RADIUS_KM as RM, D2R, eqjToMoonFixed, localBasis } from '../engine/ephemeris'
import { useT } from '../i18n'
import { useStore } from '../store'
import { compass } from '../lib/format'

const BASE = import.meta.env.BASE_URL
const NA = 540, NR = 190, R_NEAR = 10, R_FAR = 90000, CAM_H = 2.5, RING_KM = 130

/** ENU direction (az from N toward E, el above horizon) -> scene axes (x east, y up, z = -north). */
const enu = (az: number, el: number, dist = 1) => { const a = az * D2R, e = el * D2R; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(dist) }

function noiseField(size: number, octaves: number, seed: number) {
  let st = seed; const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647
  const out = new Float32Array(size * size)
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o, gw = cells + 1, grid = new Float32Array(gw * gw); for (let i = 0; i < grid.length; i++) grid[i] = rnd()
    for (let j = 0; j <= cells; j++) { grid[j * gw + cells] = grid[j * gw]; grid[cells * gw + j] = grid[j] }
    const amp = 1 / (1 << o)
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), g = (a: number, b: number) => grid[(iy + b) * gw + (ix + a)]
      out[y * size + x] += amp * ((g(0, 0) * (1 - sx) + g(1, 0) * sx) * (1 - sy) + (g(0, 1) * (1 - sx) + g(1, 1) * sx) * sy)
    }
  }
  return out
}
function regolith() {
  const size = 512, f = noiseField(size, 6, 99), c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d')!
  const img = g.createImageData(size, size); let mx = 0; f.forEach((v) => (mx = Math.max(mx, v)))
  for (let i = 0; i < size * size; i++) { const v = 118 + (f[i] / mx - 0.5) * 110; img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.985; img.data[i * 4 + 2] = v * 0.95; img.data[i * 4 + 3] = 255 }
  g.putImageData(img, 0, 0)
  let st = 4242; const rnd = () => (st = (st * 16807) % 2147483647) / 2147483647
  for (let k = 0; k < 80; k++) { const x = rnd() * size, y = rnd() * size, r = 3 + rnd() * rnd() * 24
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) { const gr = g.createRadialGradient(x + ox, y + oy, r * 0.2, x + ox, y + oy, r); gr.addColorStop(0, 'rgba(20,18,16,.32)'); gr.addColorStop(0.75, 'rgba(10,10,10,.1)'); gr.addColorStop(0.9, 'rgba(235,230,220,.2)'); gr.addColorStop(1, 'rgba(235,230,220,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill() } }
  const albedo = new THREE.CanvasTexture(c); albedo.wrapS = albedo.wrapT = THREE.RepeatWrapping; albedo.anisotropy = 8; albedo.colorSpace = THREE.SRGBColorSpace
  const b = document.createElement('canvas'); b.width = b.height = 256; const bg = b.getContext('2d')!, bi = bg.createImageData(256, 256), bf = noiseField(256, 5, 7)
  let bm = 0; bf.forEach((v) => (bm = Math.max(bm, v))); for (let i = 0; i < 256 * 256; i++) { const v = (bf[i] / bm) * 255; bi.data[i * 4] = bi.data[i * 4 + 1] = bi.data[i * 4 + 2] = v; bi.data[i * 4 + 3] = 255 }
  bg.putImageData(bi, 0, 0); const bump = new THREE.CanvasTexture(b); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(32, 32); bump.anisotropy = 8
  return { albedo, bump }
}
function glow(inner: string) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, inner); gr.addColorStop(0.18, inner.replace(/[\d.]+\)$/, '0.5)')); gr.addColorStop(1, inner.replace(/[\d.]+\)$/, '0)'))
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c)
}
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!)
  const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.anisotropy = 8; if (srgb) tx.colorSpace = THREE.SRGBColorSpace; return tx
}

/** A detailed lander (crinkled gold foil hex body, tanks, engine bell, braced legs, gridded solar wings, dish, thrusters) to give the scene scale. */
function lander(env: THREE.Texture | null) {
  const g = new THREE.Group()
  let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647
  const crinkle = canvasTex(256, 256, (c) => { c.fillStyle = '#808080'; c.fillRect(0, 0, 256, 256); for (let i = 0; i < 700; i++) { const x = rnd() * 256, y = rnd() * 256, r = 4 + rnd() * 18, v = Math.floor(70 + rnd() * 120); c.fillStyle = `rgba(${v},${v},${v},.35)`; c.beginPath(); c.moveTo(x, y); c.lineTo(x + r, y + rnd() * r); c.lineTo(x + rnd() * r, y + r); c.closePath(); c.fill() } }, false)
  crinkle.repeat.set(3, 2)
  const panelTex = canvasTex(256, 128, (c) => { const gr = c.createLinearGradient(0, 0, 256, 128); gr.addColorStop(0, '#1d2f66'); gr.addColorStop(1, '#0e1a3d'); c.fillStyle = gr; c.fillRect(0, 0, 256, 128); c.strokeStyle = 'rgba(150,180,255,.45)'; c.lineWidth = 1.5; for (let x = 0; x <= 256; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 128); c.stroke() } for (let y = 0; y <= 128; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke() } })
  const M = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ envMap: env, envMapIntensity: 0.9, ...o })
  const gold = M({ color: 0xe0b04a, metalness: 1, roughness: 0.32, bumpMap: crinkle, bumpScale: 2.2 })
  const blackFoil = M({ color: 0x1a1a1e, metalness: 0.9, roughness: 0.45, bumpMap: crinkle, bumpScale: 1.4 })
  const white = M({ color: 0xe6e4de, metalness: 0.15, roughness: 0.55 })
  const alu = M({ color: 0xb9bec6, metalness: 0.95, roughness: 0.28 })
  const dark = M({ color: 0x2b2d33, metalness: 0.7, roughness: 0.5 })
  const cell = M({ map: panelTex, metalness: 0.5, roughness: 0.3, envMapIntensity: 1.4 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m }
  // body: hex prism clad in foil, dark base plate, white top deck
  add(new THREE.CylinderGeometry(1.45, 1.45, 1.7, 6), gold, 0, 2.55)
  add(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 6), blackFoil, 0, 3.46)
  add(new THREE.CylinderGeometry(1.6, 1.6, 0.18, 6), dark, 0, 1.6)
  add(new THREE.CylinderGeometry(1.1, 1.3, 0.1, 6), white, 0, 3.57)
  // engine bell + feed
  add(new THREE.CylinderGeometry(0.24, 0.62, 0.9, 20, 1, true), dark, 0, 1.05).material.side = THREE.DoubleSide
  add(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 14), alu, 0, 1.65)
  // two spherical propellant tanks bulging from opposite faces
  for (const sx of [-1, 1]) { add(new THREE.SphereGeometry(0.62, 28, 16), alu, sx * 1.38, 2.55, 0); add(new THREE.TorusGeometry(0.64, 0.035, 8, 28), dark, sx * 1.38, 2.55, 0).rotation.y = Math.PI / 2 }
  // legs: four braced struts with crushable footpads
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a)
    const top = new THREE.Vector3(ca * 1.3, 2.0, sa * 1.3), foot = new THREE.Vector3(ca * 2.55, 0.1, sa * 2.55), mid = new THREE.Vector3(ca * 1.45, 0.95, sa * 1.45)
    const strut = (p: THREE.Vector3, q: THREE.Vector3, r: number, mat: THREE.Material) => { const d = q.clone().sub(p), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 10), mat); m.position.copy(p.clone().add(q).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(m) }
    strut(top, foot, 0.075, white); strut(mid, foot.clone().setY(0.35), 0.045, alu); strut(new THREE.Vector3(ca * 1.2, 1.75, sa * 1.2), mid, 0.045, alu)
    add(new THREE.CylinderGeometry(0.46, 0.5, 0.08, 20), alu, foot.x, 0.04, foot.z); add(new THREE.SphereGeometry(0.1, 12, 8), dark, foot.x, 0.16, foot.z)
  }
  // solar wings on short booms, gridded cells
  for (const sx of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), alu, sx * 1.95, 3.35, 0).rotation.z = Math.PI / 2
    const wing = add(new THREE.BoxGeometry(2.7, 0.05, 1.7), cell, sx * 3.3, 3.55, 0); wing.rotation.z = sx * -0.18
    add(new THREE.BoxGeometry(2.74, 0.03, 1.74), dark, sx * 3.3, 3.5, 0).rotation.z = sx * -0.18
  }
  // high-gain dish on a mast, whip antenna, camera mast, thruster quads, star tracker
  add(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 8), alu, 0.6, 4.35, 0.5)
  const dish = add(new THREE.SphereGeometry(0.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2.3), white, 0.6, 5.1, 0.5); dish.rotation.x = -0.7; dish.rotation.y = 0.5; dish.material = white.clone(); (dish.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide
  add(new THREE.CylinderGeometry(0.012, 0.012, 1.9, 6), dark, -0.7, 4.5, -0.5)
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), alu, -0.3, 3.95, 0.7); add(new THREE.BoxGeometry(0.28, 0.2, 0.2), dark, -0.3, 4.4, 0.7)
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const q = add(new THREE.CylinderGeometry(0.07, 0.1, 0.22, 10), dark, Math.cos(a) * 1.28, 3.12, Math.sin(a) * 1.28); q.lookAt(Math.cos(a) * 3, 3.12, Math.sin(a) * 3); q.rotateX(Math.PI / 2) }
  add(new THREE.BoxGeometry(0.5, 0.4, 0.36), blackFoil, 0.8, 3.8, -0.7)
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
  // soft local fill so the craft stays readable even when the Sun is at a grazing angle
  const fill = new THREE.PointLight(0xdfe8ff, 9, 34, 1.5); fill.position.set(-5, 6, -6); g.add(fill)
  const warm = new THREE.PointLight(0xffd9a0, 4, 22, 1.8); warm.position.set(6, 3, 5); g.add(warm)
  return g
}

interface Api { update(res: Result, now: Sample, exag: number, tMs: number): void; look(az: number, el?: number): void; dispose(): void }

export function SurfaceView({ res, now, tMs }: { res: Result; now: Sample; tMs: number }) {
  const t = useT()
  const host = useRef<HTMLDivElement>(null), hud = useRef<HTMLCanvasElement>(null)
  const api = useRef<Api | null>(null)
  const [exag, setExag] = useState(4)

  useEffect(() => {
    const el = host.current!, hudc = hud.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; renderer.setClearColor(0x010204)
    el.appendChild(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;cursor:grab'
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(62, 1, 0.5, 600000)
    const sun = new THREE.DirectionalLight(0xfff0d6, 3.6); sun.castShadow = true
    const SHADOW_KM = 24, mapSize = Math.min(8192, renderer.capabilities.maxTextureSize); sun.shadow.mapSize.set(mapSize, mapSize)
    const sc = sun.shadow.camera; sc.left = -SHADOW_KM * 1000; sc.right = SHADOW_KM * 1000; sc.top = 6000; sc.bottom = -6000; sc.near = 1; sc.far = 90000
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 4
    const earthLight = new THREE.DirectionalLight(0x9cc4ff, 0.0)
    const hemi = new THREE.HemisphereLight(0x24324a, 0x0c0c10, 0.5)
    scene.add(sun, sun.target, earthLight, hemi)
    // stars
    const sp = new Float32Array(1800 * 3); let s = 7; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 1800; i++) { const u = rr() * 2 - 1, th = rr() * 6.283, q = Math.sqrt(1 - u * u); sp.set([q * Math.cos(th) * 400000, Math.abs(u) * 400000, q * Math.sin(th) * 400000], i * 3) }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })))
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false, toneMapped: false }))
    const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(255,190,90,0.9)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))
    scene.add(sunDisc, sunGlow)
    const earthTex = new THREE.TextureLoader().load(`${BASE}tex/earth_2k.jpg`, () => draw()); earthTex.colorSpace = THREE.SRGBColorSpace
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 1, metalness: 0, emissive: 0x03060d, emissiveIntensity: 1 }))
    earth.matrixAutoUpdate = false; scene.add(earth)
    const earthGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow('rgba(110,170,255,0.5)'), blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); scene.add(earthGlow)
    const pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose()
    const ship = lander(env); scene.add(ship)
    let terrainMesh: THREE.Mesh | null = null, ring: THREE.Mesh | null = null, lastKey = ''
    const reg = regolith()
    let yaw = 0, pitch = 3, fov = 62, curSunAz = 0, curEarthAz = 0, curSunEl = 0, curEarthEl = 0
    const drawHud = () => {
      const w = hudc.clientWidth, h = 34, dpr = Math.min(2, window.devicePixelRatio); if (hudc.width !== w * dpr) { hudc.width = w * dpr; hudc.height = h * dpr }
      const g = hudc.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h)
      const aspect = cam.aspect, hf = (2 * Math.atan(Math.tan((fov * D2R) / 2) * aspect)) / D2R, ppd = w / hf, cx = w / 2
      g.fillStyle = 'rgba(2,4,8,.55)'; g.fillRect(0, 0, w, h); g.font = '600 10px "Geist Mono Variable", monospace'; g.textBaseline = 'middle'
      const hd = ((yaw % 360) + 360) % 360
      for (let d = Math.floor((hd - hf / 2) / 5) * 5; d <= hd + hf / 2 + 5; d += 5) {
        const x = cx + (d - hd) * ppd, a = ((d % 360) + 360) % 360, major = a % 45 === 0
        g.strokeStyle = major ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(x, h - 1); g.lineTo(x, h - (major ? 12 : 6)); g.stroke()
        if (major) { g.fillStyle = a % 90 === 0 ? '#fff' : 'rgba(255,255,255,.65)'; g.textAlign = 'center'; g.fillText(compass(a), x, 11) }
      }
      const mark = (az: number, col: string, label: string) => { let d = ((az - hd + 540) % 360) - 180; const x = Math.max(12, Math.min(w - 12, cx + d * ppd)); const edge = Math.abs(d) > hf / 2
        g.fillStyle = col; g.beginPath(); g.moveTo(x, h - 2); g.lineTo(x - 5, h - 11); g.lineTo(x + 5, h - 11); g.fill(); g.textAlign = 'center'; g.fillText(edge ? `${d < 0 ? '◂' : ''}${label}${d > 0 ? '▸' : ''}` : label, x, 20) }
      mark(curSunAz, '#ffb547', 'SUN'); mark(curEarthAz, '#5cb8ff', 'EARTH')
      g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, 5); g.stroke()
    }
    const draw = () => { cam.fov = fov; cam.updateProjectionMatrix(); cam.rotation.order = 'YXZ'; cam.rotation.set(pitch * D2R, -yaw * D2R, 0); renderer.render(scene, cam); drawHud() }

    const build = (r: Result) => {
      terrainMesh && (scene.remove(terrainMesh), terrainMesh.geometry.dispose()); ring && (scene.remove(ring), ring.geometry.dispose())
      const { lat, lon } = r.scenario, h0 = r.hor.siteHeightM, hasT = r.hor.hasTerrain, r0 = RM * 1000 + h0 + CAM_H
      const W = NA + 1, pos = new Float32Array(W * NR * 3), uv = new Float32Array(W * NR * 2), idx: number[] = []
      for (let i = 0; i < NR; i++) {
        const dist = R_NEAR * Math.pow(R_FAR / R_NEAR, i / (NR - 1)), th = dist / (RM * 1000)
        for (let j = 0; j < W; j++) {
          const az = (j / NA) * 360
          let h = h0; if (hasT) { const q = destination(lat, lon, az, th); const v = r.terrain.height(q.lat, q.lon); h = v ?? NaN }
          const rad = RM * 1000 + (Number.isNaN(h) ? 0 : h) // outside DEM coverage: sea-level sphere
          const horiz = rad * Math.sin(th), y = rad * Math.cos(th) - r0
          const e = horiz * Math.sin(az * D2R), n = horiz * Math.cos(az * D2R), k = i * W + j
          pos[k * 3] = e; pos[k * 3 + 1] = y; pos[k * 3 + 2] = -n; uv[k * 2] = e / 800; uv[k * 2 + 1] = n / 800
        }
      }
      for (let i = 0; i < NR - 1; i++) for (let j = 0; j < NA; j++) { const a = i * W + j, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, c, b, d, c) }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
      terrainMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: reg.albedo, color: 0xd2cabb, roughness: 1, metalness: 0, bumpMap: reg.bump, bumpScale: 2.4 }))
      terrainMesh.receiveShadow = true; terrainMesh.castShadow = true; terrainMesh.frustumCulled = false; scene.add(terrainMesh)
      // beyond the mesh: silhouette of the computed horizon (up to 220 km), so the skyline always matches the analysis
      const rp: number[] = [], ri: number[] = []
      for (let a = 0; a <= 360; a++) { const az = a % 360, x = Math.sin(az * D2R) * RING_KM * 1000, z = -Math.cos(az * D2R) * RING_KM * 1000, top = Math.tan(r.hor.el[az] * D2R) * RING_KM * 1000; rp.push(x, top, z, x, -9000, z) }
      for (let a = 0; a < 360; a++) { const k = a * 2; ri.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
      const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3)); rg.setIndex(ri)
      ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x17191d, side: THREE.DoubleSide })); scene.add(ring)
      // lander 9 m south of the camera, sitting on the local ground
      const q = destination(lat, lon, 180, 9 / 1000 / RM), gh = hasT ? r.terrain.height(q.lat, q.lon) : h0
      ship.position.set(0, (gh ?? h0) - h0 - CAM_H - 0.02, 9)
    }

    const place = (r: Result, nw: Sample, e: number, ms: number) => {
      curSunAz = nw.sunAz; curEarthAz = nw.earthAz; curSunEl = nw.sunEl; curEarthEl = nw.earthEl
      const sd = enu(nw.sunAz, nw.sunEl, 1)
      sun.position.copy(sd.clone().multiplyScalar(40000)); sun.target.position.set(0, 0, 0); sun.visible = nw.sunFrac > 0; sun.intensity = 3.6 * nw.sunFrac // follows the analysis: hidden behind far terrain = no light
      const dSun = RING_KM * 1000 * 1.25, rs = dSun * Math.tan(nw.sunRadius * D2R * e)
      sunDisc.position.copy(sd.clone().multiplyScalar(dSun)); sunDisc.scale.setScalar(rs); sunGlow.position.copy(sunDisc.position); sunGlow.scale.setScalar(rs * 11)
      const ed = enu(nw.earthAz, nw.earthEl, 1), dE = RING_KM * 1000 * 1.2, re = dE * Math.tan(nw.earthRadius * D2R * e)
      earth.position.copy(ed.clone().multiplyScalar(dE)); earthGlow.position.copy(earth.position); earthGlow.scale.setScalar(re * 4)
      // earthshine: the Earth's lit fraction (phase) sets how much light it throws on the ground
      const cosg = sd.dot(ed), phase = (1 - cosg) / 2 // Sun and Earth in the same direction = new Earth (dark); opposite = full Earth
      earthLight.position.copy(ed.clone().multiplyScalar(40000)); earthLight.intensity = nw.earthEl > -1 ? 0.5 * phase : 0
      // Earth orientation: ITRF -> Moon-fixed -> local ENU -> scene
      const tm = Astronomy.MakeTime(new Date(ms)), th = Astronomy.SiderealTime(tm) * 15 * D2R, M = eqjToMoonFixed(tm.tt), B = localBasis(r.scenario.lat, r.scenario.lon)
      const rz = [[Math.cos(th), -Math.sin(th), 0], [Math.sin(th), Math.cos(th), 0], [0, 0, 1]]
      const mul = (A: number[][], X: number[][]) => A.map((row) => [0, 1, 2].map((c) => row[0] * X[0][c] + row[1] * X[1][c] + row[2] * X[2][c]))
      const tot = mul(mul([[1, 0, 0], [0, 0, 1], [0, -1, 0]], mul([B.east, B.north, B.up] as number[][], mul([M[0], M[1], M[2]] as number[][], rz))), [[1, 0, 0], [0, 0, -1], [0, 1, 0]])
      earth.matrix.set(tot[0][0] * re, tot[0][1] * re, tot[0][2] * re, earth.position.x, tot[1][0] * re, tot[1][1] * re, tot[1][2] * re, earth.position.y, tot[2][0] * re, tot[2][1] * re, tot[2][2] * re, earth.position.z, 0, 0, 0, 1)
      earth.updateMatrixWorld(true); draw()
    }
    api.current = {
      update(r, nw, e, ms) { if (r.key !== lastKey || !terrainMesh) { build(r); lastKey = r.key; yaw = nw.sunlit ? nw.sunAz : nw.earthAz; pitch = Math.max(2, (nw.sunlit ? nw.sunEl : nw.earthEl) + 3) } place(r, nw, e, ms) },
      look(az, elv = 2) { yaw = az; pitch = elv; draw() },
      dispose() { renderer.dispose(); el.removeChild(renderer.domElement) },
    }
    let dragging = false, px = 0, py = 0; const cv = renderer.domElement
    cv.onpointerdown = (e) => { dragging = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing' }
    cv.onpointermove = (e) => { if (!dragging) return; yaw -= (e.clientX - px) * (fov / cv.clientHeight) * 0.9; pitch = Math.max(-25, Math.min(40, pitch + (e.clientY - py) * (fov / cv.clientHeight) * 0.9)); px = e.clientX; py = e.clientY; draw() }
    cv.onpointerup = () => { dragging = false; cv.style.cursor = 'grab' }
    cv.onwheel = (e) => { e.preventDefault(); fov = Math.max(8, Math.min(100, fov * (e.deltaY > 0 ? 1.1 : 0.9))); draw() }
    const ro = new ResizeObserver(() => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; draw() }); ro.observe(el)
    return () => { ro.disconnect(); api.current?.dispose(); api.current = null }
  }, [])

  useEffect(() => { api.current?.update(res, now, exag, tMs) }, [res, now, exag, tMs])
  const setCursor = useStore((s) => s.setCursor)
  const jump = () => {
    const A = res.analysis, i0 = Math.round((tMs - A.t0) / A.stepMs)
    for (let i = Math.max(0, i0) + 1; i < A.samples.length; i++) if (A.samples[i].sunlit) { setCursor((i * A.stepMs) / 3.6e6); return }
    for (let i = 0; i <= Math.max(0, i0); i++) if (A.samples[i].sunlit) { setCursor((i * A.stepMs) / 3.6e6); return }
  }
  const snap = (what: 'sun' | 'earth' | 'lander') => api.current?.look(what === 'sun' ? now.sunAz : what === 'earth' ? now.earthAz : 180, what === 'lander' ? -2 : Math.max(0, what === 'sun' ? now.sunEl : now.earthEl) + 1.5)
  return (
    <div className="surface">
      <div ref={host} className="surface-gl" />
      <canvas ref={hud} className="surf-compass" />
      <div className="surf-hud">
        <button className="step" onClick={() => snap('sun')}>{t('surf.sun')}</button>
        <button className="step" onClick={() => snap('earth')}>{t('surf.earth')}</button>
        <button className="step" onClick={() => snap('lander')}>{t('surf.lander')}</button>
        <label className="check"><input type="checkbox" checked={exag === 1} onChange={(e) => setExag(e.target.checked ? 1 : 4)} />{t('tab.true')}</label>
      </div>
      {!now.sunlit && <div className="surf-dark"><b>{t('surf.dark.h')}</b><span>{t('surf.dark.p')}</span><button className="btn" onClick={jump}>{t('surf.jump')}</button></div>}
      <div className="map-note mono">{t('surf.note')}</div>
    </div>
  )
}
