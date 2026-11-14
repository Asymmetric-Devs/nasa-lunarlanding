"""Hero imagery: 36-frame sweep of the Sun around the lunar south pole from the LOLA 80 m DEM.
usage: python3 -I scripts/build_hero.py <project_dir>"""
import numpy as np, json, math, sys, os, time
from PIL import Image

proj = sys.argv[1]
R = 1737.4
SIZE, RADIUS_KM, EL0, STEP, NF = 1100, 160.0, 1.6, 10, 36
raw = np.fromfile(f"{proj}/data-raw/dem80s80/ldem_80s_80m_float.img", dtype='<f4')
nb = int(math.isqrt(raw.size)); raw = raw.reshape(nb, nb); c = (nb - 1) / 2
half = int(RADIUS_KM / 0.08)                     # 2000 px
x0 = int(round(c)) - half // 1 + 0               # symmetric crop around pole centre
x0 = int(math.floor(c)) - (half - 1)             # c is x.5 -> [floor(c)-(half-1), floor(c)+half]
crop = raw[x0:x0 + 2 * half, x0:x0 + 2 * half].astype(np.float32)
crop = np.nan_to_num(crop, nan=0.0)
H = np.asarray(Image.fromarray(crop, mode='F').resize((SIZE, SIZE), Image.BOX), dtype=np.float32)  # km
W = SIZE; d = 2 * RADIUS_KM / SIZE               # km per px
cc = (SIZE - 1) / 2
jj, ii = np.mgrid[0:W, 0:W].astype(np.float32)
X = (ii - cc) * d; Y = (jj - cc) * d
rho = np.hypot(X, Y)
lat = (-90 + 2 * np.degrees(np.arctan(rho / (2 * R)))) * math.pi / 180
lon = np.arctan2(X, -Y)
cl, sl, co, so = np.cos(lat), np.sin(lat), np.cos(lon), np.sin(lon)
ux, uy, uz = cl * co, cl * so, sl
ex, ey = -so, co
nx, ny, nz = -sl * co, -sl * so, cl
# slope from DEM gradient (km/km), map frame (y down)
gy, gx = np.gradient(H, d)
slope_norm = np.sqrt(gx * gx + gy * gy + 1)
flat = np.arange(W * W)
Hf = H.ravel()
# disc mask + soft edge
r = np.hypot(ii - cc, jj - cc) / SIZE
edge = np.clip((0.5 - r) / 0.03, 0, 1); edge = edge * edge * (3 - 2 * edge)
SH = np.array([5, 7, 11], np.float32); LIT = np.array([233, 220, 192], np.float32)

def frame(a_deg):
    # Stylised hero: Sun at constant local elevation EL0 with a fixed map-plane azimuth (clockwise from map-up).
    # (The exact per-pixel geometry puts half of a 160 km disc in polar night behind a straight terminator.)
    a = math.radians(a_deg); e0 = math.radians(EL0)
    dirX = np.full((W, W), math.sin(a), np.float32); dirY = np.full((W, W), -math.cos(a), np.float32)
    el = np.full((W, W), e0, np.float32); ce = np.cos(el)
    lam = np.maximum(0, (-gx * dirX * ce - gy * dirY * ce + np.sin(el)) / slope_norm)
    sun = np.ones((W, W), bool)
    tanE = np.tan(el).astype(np.float32) + 0.0004
    shadow = np.zeros((W, W), bool)
    px0, py0 = ii + 0.5, jj + 0.5  # same convention as PolarMap (cell centres)
    s_km = d
    while s_km < 60:
        fx = (px0 + dirX * s_km / d) - 0.0; fy = (py0 + dirY * s_km / d)
        ix, iy = fx.astype(np.int32), fy.astype(np.int32)
        ok = (ix >= 0) & (iy >= 0) & (ix < W) & (iy < W)
        k = np.clip(iy, 0, W - 1) * W + np.clip(ix, 0, W - 1)
        slp = (Hf[k] - H) / s_km - s_km / (2 * R)
        shadow |= ok & (slp > tanE)
        s_km *= 1.045
        if s_km < d * 1.5: s_km += d * 0.5
    lit = sun & ~shadow
    amb = 0.03 + 0.035 * np.clip((H + 4) / 8, 0, 1)
    bright = np.clip(lam / 0.10, 0, 1) ** 0.62           # stretch raking light for readability
    grazing = np.clip(el * 14 + 0.35, 0.25, 1)
    b = np.where(lit, amb + (1 - amb) * bright * grazing, amb * (0.6 + 0.4 * np.clip((H + 4) / 8, 0, 1)))
    rgb = SH + b[..., None] * (LIT - SH)
    rgb = SH + (rgb - SH) * edge[..., None]
    return np.clip(rgb, 0, 255).astype(np.uint8)

out = f"{proj}/public/hero"; os.makedirs(out, exist_ok=True)
t = time.time()
for k in range(NF):
    img = frame(k * STEP); Image.fromarray(img).save(f"{out}/frame_{k:02d}.jpg", quality=68, optimize=True, progressive=True)
    if k == 30: Image.fromarray(img).save(f"{out}/poster.jpg", quality=88, optimize=True, progressive=True)
    print(k, round(time.time() - t), 's', os.path.getsize(f"{out}/frame_{k:02d}.jpg") // 1024, 'KB', flush=True)
json.dump({"frames": NF, "size": SIZE, "radius_km": int(RADIUS_KM), "sun_el_deg": EL0, "az_step_deg": STEP}, open(f"{out}/manifest.json", "w"))
