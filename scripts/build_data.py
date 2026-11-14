"""Build web-ready terrain assets from LOLA polar DEMs.
usage: python3 -I build_data.py <raw_dir> <project_dir>"""
import numpy as np, json, math, sys, os
from PIL import Image

Q = 4  # metres per quantisation step
def fill_nodata(h, mask):
    """Replace masked cells by the nearest valid value in the same row (rows without any valid cell copy the row above)."""
    out = h.copy(); idx = np.arange(h.shape[1]); last_row0 = 0
    for r in range(h.shape[0]):
        v = ~mask[r]
        if v.any():
            vi = idx[v]; pos = np.searchsorted(vi, idx); pos = np.clip(pos, 1, len(vi) - 1) if len(vi) > 1 else np.zeros_like(idx)
            left = vi[np.clip(pos - 1, 0, len(vi) - 1)]; right = vi[pos]
            near = np.where(np.abs(idx - left) <= np.abs(idx - right), left, right)
            out[r] = h[r][near]; last_row0 = out[r][0]
        else:
            out[r] = last_row0
    return out

def encode_delta(h16, nodata_mask=None):
    """h16: int16 metres. File layout: int16 LE first value (in Q steps) per row, then int8 row-wise deltas (n_c-1 per row)."""
    q = np.round(h16 / Q).astype(np.int32)
    d = np.diff(q, axis=1)
    if d.min() < -127 or d.max() > 127: raise ValueError('delta overflow %d %d' % (d.min(), d.max()))
    return np.concatenate([q[:, 0].astype('<i2').view(np.uint8), d.astype(np.int8).view(np.uint8).ravel()])

raw, proj = sys.argv[1], sys.argv[2]
R = 1737.4

# ---- 240 m cap 75S..90S, int16 metres (relative to 1737.4 km sphere) ----
a = np.fromfile(f"{raw}/dem75s240/ldem_75s_240m_float.img", dtype='<f4').reshape(3812, 3812)
n = 3812; c = 1905.5  # 0-based index of the pole = LINE/SAMPLE_PROJECTION_OFFSET of the label = (n - 1) / 2
yy, xx = np.mgrid[0:n, 0:n]
rho_px = np.hypot(xx - c, yy - c)
rmax = 2 * R * math.tan(math.radians(7.5)) / 0.24  # 75S circle
h = np.where(rho_px <= rmax, np.round(a * 1000), -32768).astype('<i2')
mask = (h == -32768)
enc = encode_delta(fill_nodata(h, mask))
enc.tofile(f"{proj}/public/data/polar240.d8")
json.dump({"n": n, "res_m": 240, "center": c, "radius_km": R, "units": "m", "nodata": -32768, "q": Q, "enc": "d8",
           "proj": "south polar stereographic, x=rho*sin(lon), y=-rho*cos(lon) (row down)",
           "extent_latmax": -75}, open(f"{proj}/public/data/polar240.json", "w"))
print("240m ok", h.shape, (h == -32768).mean())

# ---- 80 m polar core, radius 150 km (to ~88.6S) ----
b0 = np.fromfile(f"{raw}/dem80s80/ldem_80s_80m_float.img", dtype='<f4')
nb0 = int(math.isqrt(b0.size)); b0 = b0.reshape(nb0, nb0); cc0 = (nb0 - 1) / 2
hw = int(150 / 0.08)
x0c = int(round(cc0)) - hw; core = np.round(b0[x0c:x0c + 2 * hw, x0c:x0c + 2 * hw] * 1000).astype('<i2')
encode_delta(core).tofile(f"{proj}/public/data/core80.d8")
json.dump({"n": 2 * hw, "res_m": 80, "c": cc0, "x0": x0c, "y0": x0c, "nodata": -32768, "q": Q, "enc": "d8"}, open(f"{proj}/public/data/core80.json", "w"))
print("core", core.shape)
del b0

# ---- 80 m local tiles (24 km square) for polar curated sites ----
b = np.fromfile(f"{raw}/dem80s80/ldem_80s_80m_float.img", dtype='<f4')
nb = int(math.isqrt(b.size)); b = b.reshape(nb, nb); cb = (nb - 1) / 2  # symmetric around pole
print("80m grid", nb)
def site_px(lat, lon, res_km, cc):
    rho = 2 * R * math.tan(math.radians(90 + lat) / 2)
    return cc + rho * math.sin(math.radians(lon)) / res_km, cc - rho * math.cos(math.radians(lon)) / res_km
sites = json.load(open(f"{proj}/src/data/sites.json"))
tiles = {}
half = 150  # samples -> 300x300 @ 80 m = 24 km
for s in sites:
    if s["lat"] > -80: continue
    cx, cy = site_px(s["lat"], s["lon"], 0.08, cb)
    x0, y0 = int(round(cx)) - half, int(round(cy)) - half
    if x0 < 0 or y0 < 0 or x0 + 2 * half > nb or y0 + 2 * half > nb: print("skip", s["id"]); continue
    t = np.round(b[y0:y0 + 2 * half, x0:x0 + 2 * half] * 1000).astype('<i2')
    encode_delta(t).tofile(f"{proj}/public/data/tile_{s['id']}.d8")
    tiles[s["id"]] = {"n": 2 * half, "res_m": 80, "x0": x0, "y0": y0, "q": Q, "enc": "d8"}
json.dump({"center": cb, "tiles": tiles}, open(f"{proj}/public/data/tiles.json", "w"))
print("tiles", list(tiles))

# ---- textures ----
Image.open(f"{raw}/moonkit/lroc_color_2k.jpg").convert('RGB').save(f"{proj}/public/tex/moon_color_2k.jpg", quality=88)
Image.open(f"{raw}/moonkit/ldem_3_8bit.jpg").save(f"{proj}/public/tex/moon_height_1k.jpg", quality=92)
