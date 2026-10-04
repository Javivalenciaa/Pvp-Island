import numpy as np, wave
SR = 44100; D = 30.0; N = int(SR * D); t = np.arange(N) / SR; rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)
def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR); n = min(len(sig), N - i)
    if n <= 0: return
    L[i:i+n] += sig[:n] * gain * (1 - max(0, pan)); R[i:i+n] += sig[:n] * gain * (1 + min(0, pan))
def env(n, a, r):  # attack/release seconds
    e = np.ones(n); na = int(a * SR); nr = int(r * SR)
    if na: e[:na] = np.linspace(0, 1, na)
    if nr: e[-nr:] *= np.linspace(1, 0, nr)
    return e
def note(f, dur, kind='saw', vol=.2):
    n = int(dur * SR); tt = np.arange(n) / SR
    if kind == 'saw': s = sum(((2 * ((f * k * tt) % 1) - 1) / k) for k in (1, 2, 3)) * .5 + np.sin(2 * np.pi * f * tt) * .4
    elif kind == 'pad': s = sum(np.sin(2 * np.pi * f * (1 + d) * tt) for d in (-.004, 0, .004)) / 3 + .3 * np.sin(2 * np.pi * f * 2 * tt)
    else: s = np.sin(2 * np.pi * f * tt)
    return s * vol
def kick(vol=.9):
    n = int(.35 * SR); tt = np.arange(n) / SR; f = 120 * np.exp(-tt * 18) + 38; return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * vol
def snare(vol=.5):
    n = int(.22 * SR); tt = np.arange(n) / SR; return (rng.standard_normal(n) * np.exp(-tt * 22) * .8 + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 28) * .5) * vol
def hat(vol=.15):
    n = int(.05 * SR); tt = np.arange(n) / SR; x = rng.standard_normal(n); x = np.diff(x, prepend=0); return x * np.exp(-tt * 70) * vol
def boom(vol=1.0):
    n = int(2.6 * SR); tt = np.arange(n) / SR; nz = rng.standard_normal(n)
    # lowpass noise by cumulative smoothing
    k = 60; nz = np.convolve(nz, np.ones(k) / k, mode='same') * 4
    return (nz * np.exp(-tt * 2.2) * .9 + np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tt * 2.5) + 28) / SR) * np.exp(-tt * 1.6) * 1.1) * vol
def whoosh(dur, vol=.35):
    n = int(dur * SR); tt = np.arange(n) / SR; nz = rng.standard_normal(n); k = 30; nz = np.convolve(nz, np.ones(k) / k, mode='same') * 3; return nz * np.sin(np.pi * tt / dur) ** 2 * vol
m = lambda n: 440 * 2 ** ((n - 69) / 12)
# sections (seconds): aerial 0-3, farm 3-8.6, build 8.6-14.2, fight 14.2-20.6, boom 20.6-27, outro 27-30
prog = [57, 53, 60, 55]  # Am F C G (roots, MIDI)
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
# pad bed throughout, 3.5 s per chord
for ci, st in enumerate(np.arange(0, D, 3.5)):
    ch = chords[ci % 4]
    for nn in ch: add(note(m(nn - 12), 4.2, 'pad', .11) * env(int(4.2 * SR), 1.0, 1.4), st, pan=(nn % 3 - 1) * .3)
    add(note(m(ch[0] - 24), 3.6, 'sine', .3) * env(int(3.6 * SR), .05, .8), st)
# arpeggio from build on
beat = 60 / 120.0
for tt0 in np.arange(8.6, 27.0, beat / 2):
    ci = int(tt0 // 3.5) % 4; ch = chords[ci]; nn = ch[int((tt0 / (beat / 2))) % 3] + 12 * (int(tt0 / beat) % 2)
    add(note(m(nn), .22, 'saw', .09) * env(int(.22 * SR), .005, .12), tt0, pan=.4 if (int(tt0 / (beat / 2)) % 2) else -.4)
# drums: farm light (kick on beats), fight+boom full
for tt0 in np.arange(3.0, 8.6, beat * 2): add(kick(.5), tt0)
for tt0 in np.arange(8.6, 14.2, beat): add(kick(.6), tt0)
for tt0 in np.arange(14.2, 27.0, beat):
    add(kick(.9), tt0); 
    if int(round((tt0 - 14.2) / beat)) % 2 == 1: add(snare(.55), tt0)
for tt0 in np.arange(14.2, 27.0, beat / 2): add(hat(.16), tt0, pan=.3)
# risers and booms (renders 14, 26, 36 of boom scene => 20.6 + n/10)
add(whoosh(2.8, .5), 0.0); add(whoosh(1.6, .5), 19.0); add(whoosh(1.4, .5), 20.5 - 1.0 + .4)
for tb, v in [(20.6 + 1.4, 1.0), (20.6 + 2.6, 1.0), (20.6 + 3.6, .85)]: add(boom(v), tb); add(whoosh(.5, .0), tb)
# outro resolve chord with long tail
for nn in [57, 60, 64, 69]: add(note(m(nn), 3.0, 'pad', .14) * env(int(3.0 * SR), .2, 2.0), 27.0)
# final hit under title
add(boom(.5), 27.2)
# gentle reverb: few feedback taps
def rev(x):
    y = x.copy()
    for d, g in [(.045, .35), (.083, .28), (.131, .22), (.197, .16)]:
        k = int(d * SR); y[k:] += x[:-k] * g
    return y
L, R = rev(L), rev(R)
mx = max(np.abs(L).max(), np.abs(R).max()); L, R = L / mx * .9, R / mx * .9
# fade in/out
f = np.minimum(1, t / .3) * np.minimum(1, (D - t) / 1.2); L *= f; R *= f
pcm = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open('soundtrack.wav', 'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', D)
