"""Generates the Sunline demo film (1920x1080, 30 fps).
usage: python3 build_film.py [en|es]
  en (default): index.html + compositions/s1..s5.html           (28.9 s)
  es:           variants/index.es.html + compositions/es/s1..s5.html   (29.1 s, female voice, theory-focused copy)
Render with: npx hyperframes render [-c variants/index.es.html]"""
import os, sys, wave
LANG = sys.argv[1] if len(sys.argv) > 1 else 'en'
assert LANG in ('en', 'es')
P = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the demo-video/ folder
SHOTS = 'shots' if LANG == 'en' else f'shots_{LANG}'
VOICE = 'voice' if LANG == 'en' else f'voice_{LANG}'
SUF = '' if LANG == 'en' else f'.{LANG}'
CDIR = 'compositions' if LANG == 'en' else f'compositions/{LANG}'
os.makedirs(f'{P}/{CDIR}', exist_ok=True)
def wav_len(path):
    with wave.open(path) as w: return w.getnframes() / w.getframerate()

# ---- on-screen copy (EN is the delivered language; ES is for the team) ----
T = {'en': dict(
    s1k='Lunar south pole', s1a='Extreme<br>shadows', s1b='Comms<br>blackouts',
    s2c1='<b>●</b> Runs 100% in your browser', s2c2='NASA LRO · LOLA terrain · <b>80 m/px</b>', s2c3='Astronomy checked vs <b>JPL Horizons</b>',
    s3c1='360° horizon · <b>4</b> scenarios', s3c2='Lander <b>100 m</b> off target', s3c3='<b>9</b> landing points · ±25 m to ±500 m', s3x='',
    s4c1='<b>3–30 day</b> missions · 12 months', s4c2='Find <b>windows that still work</b>', s4x='',
    s5k='Validated against NASA data', s5v1='&lt;0.005°', s5l1='Sun &amp; Earth direction<br>vs JPL Horizons', s5v2='r 0.98', s5l2='Sun visibility<br>vs LOLA maps',
    s5v3='r 0.99', s5l3='Earth visibility<br>vs LOLA maps', s5n='300 points, 18.6-year average', s5t1='Lunar Landing Site Navigator', s5t2='NASA Space Apps Challenge 2026'),
 'es': dict(
    s1k='Polo sur lunar', s1a='Sombras<br>extremas', s1b='Apagones de<br>comunicación',
    s2c1='<b>●</b> Todo en tu navegador', s2c2='Relieve LOLA · <b>80 m/px</b> · NASA LRO', s2c3='Estereográfica polar: <b>rho = 2R·tan((90° + lat) / 2)</b>',
    s3c1='Horizonte 360° · <b>4</b> escenarios', s3c2='A <b>100 m</b> de la meta', s3c3='<b>9</b> puntos de aterrizaje · ±25 m a ±500 m', s3x='elev = atan2(r1·cos(th) - r0, r1·sin(th))',
    s4c1='<b>3–30 días</b> · 12 meses', s4c2='Ventanas que <b>resisten retrasos</b>', s4x='Marco lunar IAU 2015 · libración · paralaje 0,26°',
    s5k='Validado con datos de la NASA', s5v1='&lt;0,005°', s5l1='Dirección Sol y Tierra<br>vs JPL Horizons', s5v2='r 0,98', s5l2='Sol visible<br>vs mapas LOLA',
    s5v3='r 0,99', s5l3='Tierra visible<br>vs mapas LOLA', s5n='300 puntos, promedio de 18,6 años', s5t1='Navegador de sitios de alunizaje', s5t2='NASA Space Apps Challenge 2026')}[LANG]

FONTS = """
@font-face{font-family:'Big Shoulders';src:url('assets/fonts/bigshoulders.woff2') format('woff2');font-weight:100 900}
@font-face{font-family:'Geist';src:url('assets/fonts/geist.woff2') format('woff2');font-weight:100 900}
@font-face{font-family:'Geist Mono';src:url('assets/fonts/geistmono.woff2') format('woff2');font-weight:100 900}
"""
BASE = """
#root{position:absolute;inset:0;overflow:hidden;background:#06080c;font-family:'Geist',sans-serif;color:#efece4}
.cam{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
.cam img{position:absolute;left:0;top:0;width:1920px;height:1080px}
.chip{position:absolute;font:600 30px/1 'Geist Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#efece4;background:#0b1015;border:2px solid #ffb547;padding:16px 24px 14px 24px;white-space:nowrap}
.chip b{color:#ffb547;font-weight:700}
.h1{position:absolute;font:800 132px/0.92 'Big Shoulders',sans-serif;text-transform:uppercase;letter-spacing:.005em;color:#efece4}
.kick{position:absolute;font:600 32px/1 'Geist Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:#ffb547}
.scrim{position:absolute;inset:0}
.bscrim{position:absolute;left:0;right:0;bottom:0;height:270px;background:linear-gradient(180deg,rgba(6,8,12,0) 0%,#06080c 42%)}
"""

# ES-only extras (empty for EN): the polar-ray formula chip in S3 and the IAU-model chip in S4
def _extra(cid, top, text, t_in, t_out):
    if not text: return '', ''
    html = f'<div id="{cid}" class="chip" style="left:192px;top:{top}px;opacity:0">{text}</div>\n'
    js = ("\n" + f"tl.fromTo('#{cid}', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, {t_in});\n"
          f"tl.to('#{cid}', {{ opacity: 0, duration: 0.2 }}, {t_out});")
    return html, js
S3X_HTML, S3X_JS = _extra('s3-c1b', 800, T['s3x'], 0.8, 2.6)
S4X_HTML, S4X_JS = _extra('s4-c3', 800, T['s4x'], 0.8, 3.2)

def frames(prefix, name, n, z0=0):
    return '\n'.join(f'<img id="{prefix}-f{i}" src="assets/{SHOTS}/{name}_{i:02d}.png" style="opacity:{1 if i == 0 else 0}">' for i in range(n))

def scene(sid, body, script, extra_css=''):
    return f"""<template>
<style>
{FONTS}{BASE}{extra_css}
</style>
<div id="root" data-composition-id="{sid}" data-width="1920" data-height="1080">
{body}
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{script}
window.__timelines["{sid}"] = tl;
</script>
</template>
"""

def cam(sx, sy, w, h, scale=None):
    """transform that fits canvas region (sx,sy,w,h) into the 1920x1080 frame (by width unless scale given)"""
    s = scale if scale else min(1920 / w, 1080 / h)
    return s, -sx * s + (1920 - w * s) / 2, -sy * s + (1080 - h * s) / 2

# ---------------- S1: the problem (0 - 5.5 s) horizon time-lapse ----------------
s0, x0, y0 = cam(290, 275, 1268, 790)
s1_, x1, y1 = cam(290, 275, 1268, 790, scale=s0 * 1.08)
N1 = 24; STEP1 = 5.1 / N1
s1 = scene('s1', f"""
<div id="s1-cam" class="cam">
{frames('s1', 'horizon', N1)}
</div>
<div class="scrim" style="background:linear-gradient(90deg,rgba(6,8,12,.94) 0%,rgba(6,8,12,.78) 36%,rgba(6,8,12,0) 62%)"></div>
<div id="s1-kick" class="kick" style="left:192px;top:150px">{T['s1k']}</div>
<div id="s1-h1a" class="h1" style="left:192px;top:200px">{T['s1a']}</div>
<div id="s1-h1b" class="h1" style="left:192px;top:490px;color:#5cb8ff">{T['s1b']}</div>
""", f"""
tl.fromTo('#s1-cam', {{ scale: {s0:.4f}, x: {x0:.1f}, y: {y0:.1f} }}, {{ scale: {s1_:.4f}, x: {x1:.1f}, y: {y1:.1f}, duration: 5.5, ease: 'none' }}, 0);
{chr(10).join(f"tl.to('#s1-f{i}', {{ opacity: 1, duration: {STEP1*0.9:.3f}, ease: 'none' }}, {0.15 + i*STEP1:.3f});" for i in range(1, N1))}
tl.fromTo('#s1-kick', {{ opacity: 0, x: -30 }}, {{ opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }}, 0.25);
tl.fromTo('#s1-h1a', {{ opacity: 0, y: 50, filter: 'blur(10px)' }}, {{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power4.out' }}, 0.45);
tl.fromTo('#s1-h1b', {{ opacity: 0, y: 50, filter: 'blur(10px)' }}, {{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power4.out' }}, 1.5);
""")

# ---------------- S2: in your browser (5.4 - 10.9 s) polar map time-lapse ----------------
a0, ax0, ay0 = 1.0, 0, 0
a1, bx1, by1 = cam(290, 275, 1268, 525, scale=1.5)
N2 = 30; STEP2 = 4.9 / N2
s2 = scene('s2', f"""
<div id="s2-cam" class="cam">
{frames('s2', 'polar', N2)}
</div>
<div id="s2-c1" class="chip" style="left:192px;top:760px">{T['s2c1']}</div>
<div id="s2-c2" class="chip" style="left:192px;top:828px">{T['s2c2']}</div>
<div id="s2-c3" class="chip" style="left:192px;top:896px">{T['s2c3']}</div>
""", f"""
tl.fromTo('#s2-cam', {{ scale: 1, x: 0, y: 0 }}, {{ scale: {a1:.4f}, x: {bx1:.1f}, y: {by1:.1f}, duration: 2.4, ease: 'power3.inOut' }}, 0.1);
tl.to('#s2-cam', {{ scale: {a1*1.06:.4f}, x: {bx1 - 40:.1f}, y: {by1 - 20:.1f}, duration: 3.0, ease: 'none' }}, 2.5);
{chr(10).join(f"tl.to('#s2-f{i}', {{ opacity: 1, duration: {STEP2*0.9:.3f}, ease: 'none' }}, {0.1 + i*STEP2:.3f});" for i in range(1, N2))}
tl.fromTo('#s2-c1', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 1.5);
tl.fromTo('#s2-c2', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 2.1);
tl.fromTo('#s2-c3', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 2.7);
""")

# ---------------- S3: compare + sensitivity (10.8 - 16.8 s) ----------------
cA0, cAx0, cAy0 = 1.0, 0, 0
cA1, cAx1, cAy1 = cam(236, 307, 1448, 442, scale=1.28)
cB, cBx, cBy = cam(236, 643, 945, 336, scale=2.0)
s3 = scene('s3', f"""
<div id="s3-camA" class="cam"><img src="assets/{SHOTS}/compare_top.png"></div>
<div id="s3-camB" class="cam" style="opacity:0"><img src="assets/{SHOTS}/compare_sens.png">
  <div id="s3-ringC" style="position:absolute;left:{370}px;top:{828}px;width:110px;height:66px;border:3px solid #efece4;border-radius:6px"></div>
  <div id="s3-ringD" style="position:absolute;left:{485}px;top:{828}px;width:112px;height:66px;border:3px solid #ff6b5e;border-radius:6px"></div>
</div>
<div class="bscrim"></div>
{S3X_HTML}<div id="s3-c1" class="chip" style="left:192px;top:880px">{T['s3c1']}</div>
<div id="s3-big" class="h1" style="left:1090px;top:90px;font-size:170px;opacity:0;color:#ffb547;white-space:nowrap">65% <span style="color:#efece4">→</span> <span style="color:#ff6b5e">22%</span></div>
<div id="s3-c2" class="chip" style="left:1090px;top:880px;opacity:0">{T['s3c2']}</div>
<div id="s3-c3" class="chip" style="left:192px;top:880px;opacity:0">{T['s3c3']}</div>
""", f"""
tl.fromTo('#s3-camA', {{ scale: 1, x: 0, y: 0 }}, {{ scale: {cA1:.4f}, x: {cAx1:.1f}, y: {cAy1:.1f}, duration: 2.6, ease: 'power3.inOut' }}, 0.05);
tl.fromTo('#s3-c1', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 0.4);
tl.to('#s3-c1', {{ opacity: 0, duration: 0.2 }}, 2.6);{S3X_JS}
tl.fromTo('#s3-camB', {{ opacity: 0, scale: {cB*0.9:.4f}, x: {cBx*0.9:.1f}, y: {cBy*0.9:.1f} }}, {{ opacity: 1, scale: {cB:.4f}, x: {cBx:.1f}, y: {cBy:.1f}, duration: 0.7, ease: 'power3.out' }}, 2.6);
tl.fromTo('#s3-c3', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 2.9);
tl.fromTo('#s3-ringC', {{ opacity: 0, scale: 1.4 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }}, 3.2);
tl.fromTo('#s3-ringD', {{ opacity: 0, scale: 1.4 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' }}, 3.6);
tl.fromTo('#s3-big', {{ opacity: 0, y: 40, filter: 'blur(10px)' }}, {{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.5, ease: 'power4.out' }}, 3.7);
tl.fromTo('#s3-c2', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 3.95);
""")

# ---------------- S4: date planner (16.8 - 22.3 s) ----------------
pH, pHx, pHy = cam(236, 389, 1448, 222, scale=1.3)
pC, pCx, pCy = cam(236, 707, 1448, 251, scale=1.3)
s4 = scene('s4', f"""
<div id="s4-cam" class="cam"><img src="assets/{SHOTS}/planner.png">
  <div id="s4-sweep" style="position:absolute;left:404px;top:392px;width:46px;height:224px;background:rgba(255,255,255,.16);border-left:3px solid #efece4;border-right:3px solid #efece4"></div>
</div>
<div class="bscrim"></div>
{S4X_HTML}<div id="s4-c1" class="chip" style="left:192px;top:880px">{T['s4c1']}</div>
<div id="s4-c2" class="chip" style="left:192px;top:880px;opacity:0">{T['s4c2']}</div>
""", f"""
tl.fromTo('#s4-cam', {{ scale: 1, x: 0, y: 0 }}, {{ scale: {pH:.4f}, x: {pHx:.1f}, y: {pHy:.1f}, duration: 1.3, ease: 'power3.inOut' }}, 0.05);
tl.fromTo('#s4-c1', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 0.8);
tl.set('#s4-sweep', {{ x: 0 }}, 0);
tl.fromTo('#s4-sweep', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.2 }}, 1.3);
tl.to('#s4-sweep', {{ x: 1290, duration: 1.7, ease: 'power1.inOut' }}, 1.5);
tl.to('#s4-sweep', {{ opacity: 0, duration: 0.25 }}, 3.2);
tl.to('#s4-c1', {{ opacity: 0, duration: 0.2 }}, 3.2);{S4X_JS}
tl.to('#s4-cam', {{ scale: {pC:.4f}, x: {pCx:.1f}, y: {pCy:.1f}, duration: 1.0, ease: 'power3.inOut' }}, 3.3);
tl.fromTo('#s4-c2', {{ opacity: 0, y: 30 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' }}, 3.5);
""")

# ---------------- S5: validation + end card (22.3 - 28.9 s) ----------------
s5 = scene('s5', f"""
<div id="s5-grid" style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:64px 64px"></div>
<div id="s5-vwrap">
  <div id="s5-k" class="kick" style="left:192px;top:150px">{T['s5k']}</div>
  <div id="s5-n1" style="position:absolute;left:192px;top:260px;width:560px"><div style="font:800 168px/0.9 'Big Shoulders';color:#ffb547">{T['s5v1']}</div><div style="font:600 32px/1.3 'Geist Mono';text-transform:uppercase;letter-spacing:.06em;margin-top:18px">{T['s5l1']}</div></div>
  <div id="s5-n2" style="position:absolute;left:830px;top:260px;width:440px"><div style="font:800 168px/0.9 'Big Shoulders';color:#ffb547">{T['s5v2']}</div><div style="font:600 32px/1.3 'Geist Mono';text-transform:uppercase;letter-spacing:.06em;margin-top:18px">{T['s5l2']}</div></div>
  <div id="s5-n3" style="position:absolute;left:1330px;top:260px;width:440px"><div style="font:800 168px/0.9 'Big Shoulders';color:#5cb8ff">{T['s5v3']}</div><div style="font:600 32px/1.3 'Geist Mono';text-transform:uppercase;letter-spacing:.06em;margin-top:18px">{T['s5l3']}</div></div>
  <div id="s5-note" class="chip" style="left:192px;top:760px;border-color:#2a3541;color:#929ca7">{T['s5n']}</div>
</div>
<div id="s5-end" style="position:absolute;inset:0;opacity:0">
  <div id="s5-mark" style="position:absolute;left:430px;top:330px;width:240px;height:240px"><img src="assets/logo/sunline.svg" style="width:240px;height:240px"></div>
  <div id="s5-word" style="position:absolute;left:720px;top:318px;font:800 250px/1 'Big Shoulders';letter-spacing:.02em;color:#efece4;clip-path:inset(0 100% 0 0)">SUNLINE</div>
  <div id="s5-tag" class="kick" style="left:430px;top:640px;color:#efece4">{T['s5t1']}</div>
  <div id="s5-tag2" style="position:absolute;left:430px;top:700px;font:500 32px/1.3 'Geist Mono';color:#929ca7;letter-spacing:.06em;text-transform:uppercase">{T['s5t2']}</div>
</div>
""", f"""
tl.fromTo('#s5-k', {{ opacity: 0, x: -30 }}, {{ opacity: 1, x: 0, duration: 0.4, ease: 'power3.out' }}, 0.2);
tl.fromTo('#s5-n1', {{ opacity: 0, y: 50, filter: 'blur(10px)' }}, {{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, ease: 'power4.out' }}, 0.5);
tl.fromTo('#s5-n2', {{ opacity: 0, y: 50, filter: 'blur(10px)' }}, {{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, ease: 'power4.out' }}, 1.0);
tl.fromTo('#s5-n3', {{ opacity: 0, y: 50, filter: 'blur(10px)' }}, {{ opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.55, ease: 'power4.out' }}, 1.5);
tl.fromTo('#s5-note', {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, 1.45);
tl.to('#s5-vwrap', {{ opacity: 0, y: -40, duration: 0.4, ease: 'power2.in' }}, 3.05);
tl.to('#s5-end', {{ opacity: 1, duration: 0.01 }}, 3.4);
tl.fromTo('#s5-mark', {{ scale: 0.2, rotation: -35, opacity: 0 }}, {{ scale: 1, rotation: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.6)' }}, 3.45);
tl.fromTo('#s5-word', {{ clipPath: 'inset(0 100% 0 0)' }}, {{ clipPath: 'inset(0 0% 0 0)', duration: 0.6, ease: 'power3.out' }}, 3.9);
tl.fromTo('#s5-tag', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }}, 4.4);
tl.fromTo('#s5-tag2', {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' }}, 4.6);
""")

for n, c in [(1, s1), (2, s2), (3, s3), (4, s4), (5, s5)]:
    open(f'{P}/{CDIR}/s{n}.html', 'w').write(c)

# ---------------- root ----------------
if LANG == 'en':
    B = [(0.0, 5.5), (5.4, 10.9), (10.8, 16.8), (16.7, 22.3), (22.2, 28.9)]
    VSTART = [0.45, 5.65, 11.05, 16.95, 22.55]; VDUR = [5.01, 5.23, 5.67, 3.01, 5.67]
else:  # scene slots follow the voice-over lengths (assets/voice_es/vo1..5.wav)
    B = [(0.0, 5.0), (4.9, 10.4), (10.3, 16.4), (16.3, 21.9), (21.8, 29.1)]
    VSTART = [0.4, 5.2, 10.65, 16.65, 22.15]; VDUR = [round(wav_len(f'{P}/assets/{VOICE}/vo{i+1}.wav'), 2) for i in range(5)]
TOTAL = B[-1][1]; ST = [round(b[0], 2) for b in B]
hosts = '\n'.join(f"""<div id="s{i+1}" class="clip" data-composition-id="s{i+1}" data-composition-src="{CDIR}/s{i+1}.html" data-start="{a}" data-duration="{round(b-a,2)}" data-track-index="{i+1}" data-track-kind="graphics" data-width="1920" data-height="1080"></div>""" for i, (a, b) in enumerate(B))
wipes = '\n'.join(f"""<div id="wipe{i}" class="clip wipe" data-start="{a-0.05:.2f}" data-duration="0.6" data-track-index="{41+i}"><i></i></div>""" for i, a in enumerate(ST[1:]))
wipe_tw = '\n'.join(f"rl.fromTo('#wipe{i} i', {{ xPercent: -110 }}, {{ xPercent: 110, duration: 0.5, ease: 'power3.inOut' }}, {a-0.02:.2f});" for i, a in enumerate(ST[1:]))
voice = list(zip(VSTART, VDUR))
audio = '\n'.join(f"""<audio id="vo{i+1}" class="clip" src="assets/{VOICE}/vo{i+1}.wav" data-start="{s}" data-duration="{d}" data-track-index="{10+i}" data-volume="2.4"></audio>""" for i, (s, d) in enumerate(voice))
r2 = lambda x: round(x, 2)
sfx = [('sfx-hit', 'impact-bass-1', 0.0, 1.5, 0.9), ('sfx-w1', 'whoosh-short', r2(ST[1] - 0.1), 0.57, 1.4), ('sfx-w2', 'whoosh-short', r2(ST[2] - 0.1), 0.57, 1.4), ('sfx-w3', 'whoosh-short', r2(ST[3] - 0.1), 0.57, 1.4), ('sfx-w4', 'whoosh-cinematic', r2(ST[4] - 0.2), 1.6, 1.0),
       ('sfx-c1', 'click-soft', r2(ST[2] + 3.2), 0.37, 1.2), ('sfx-c2', 'click-soft', r2(ST[2] + 3.6), 0.37, 1.2), ('sfx-sw', 'riser', r2(ST[3] + 1.4), 2.0, 0.5), ('sfx-ch', 'chime', r2(ST[4] + 0.75), 2.0, 0.9), ('sfx-sp', 'sparkle', r2(ST[4] + 3.4), 1.5, 0.8)]
sfx_html = '\n'.join(f"""<audio id="{i}" class="clip" src="assets/sfx/{f}.mp3" data-start="{s}" data-duration="{d}" data-track-index="{30+k}" data-volume="{v}"></audio>""" for k, (i, f, s, d, v) in enumerate(sfx))

root = f"""<!doctype html>
<html lang="{LANG}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920, height=1080">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
* {{ margin:0; padding:0; box-sizing:border-box }}
html, body {{ width:1920px; height:1080px; overflow:hidden; background:#06080c }}
#root {{ position:absolute; inset:0; background:#06080c; overflow:hidden }}
.wipe {{ position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:50 }}
.wipe i {{ position:absolute; top:-10%; left:0; width:100%; height:120%; background:#ffb547; transform:skewX(-14deg) }}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{TOTAL}" data-width="1920" data-height="1080">
{hosts}
{wipes}
{audio}
<audio id="music" class="clip" src="assets/music/bed.wav" data-start="0" data-duration="{TOTAL}" data-track-index="20" data-volume="0.3"></audio>
{sfx_html}
</div>
<script>
const rl = gsap.timeline({{ paused: true }});
{wipe_tw}
window.__timelines["main"] = rl;
</script>
</body>
</html>
"""
ROOT_OUT = f'{P}/index.html' if LANG == 'en' else f'{P}/variants/index.{LANG}.html'  # a 2nd root-level html would fail `hyperframes check`
os.makedirs(os.path.dirname(ROOT_OUT), exist_ok=True)
open(ROOT_OUT, 'w').write(root)
print('written')
