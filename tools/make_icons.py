"""Genera los iconos PNG de la app sin dependencias (python3 tools/make_icons.py)."""
import math, os, struct, zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
C1, C2 = (0x1B, 0xB5, 0x9C), (0x0A, 0x66, 0x59)

def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)

def render(size, scale=1.0):
    R, W, ARC = 0.29 * scale, 0.075 * scale, math.radians(285)
    end = (0.5 + R * math.sin(ARC), 0.5 - R * math.cos(ARC))
    start = (0.5, 0.5 - R)
    chk = [(0.5 + (x - 0.5) * scale, 0.5 + (y - 0.5) * scale) for x, y in [(0.39, 0.51), (0.47, 0.59), (0.625, 0.43)]]
    CW = 0.062 * scale
    rows = []
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            x, y = (i + 0.5) / size, (j + 0.5) / size
            t = (x + y) / 2
            bg = [C1[k] + (C2[k] - C1[k]) * t for k in range(3)]
            dx, dy = x - 0.5, y - 0.5
            r = math.hypot(dx, dy)
            th = math.atan2(dx, -dy) % (2 * math.pi)
            ring = abs(r - R) - W / 2
            if th <= ARC:
                arc = ring
            else:
                arc = min(math.hypot(x - start[0], y - start[1]), math.hypot(x - end[0], y - end[1])) - W / 2
            check = min(seg_dist(x, y, *chk[0], *chk[1]), seg_dist(x, y, *chk[1], *chk[2])) - CW / 2
            a_ring = max(0, min(1, 0.5 - ring * size)) * 0.28
            a_fg = max(0, min(1, 0.5 - min(arc, check) * size))
            a = max(a_ring, a_fg)
            row += bytes(int(round(bg[k] + (255 - bg[k]) * a)) for k in range(3))
        rows.append(bytes(row))
    return b''.join(rows)

def png(path, size, scale=1.0):
    raw = render(size, scale)
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) \
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(data)
    print('ok', path)

os.makedirs(OUT, exist_ok=True)
png(os.path.join(OUT, 'apple-touch-icon.png'), 180)
png(os.path.join(OUT, 'icon-192.png'), 192)
png(os.path.join(OUT, 'icon-512.png'), 512)
png(os.path.join(OUT, 'icon-maskable-512.png'), 512, scale=0.78)
png(os.path.join(OUT, 'favicon-32.png'), 32)
