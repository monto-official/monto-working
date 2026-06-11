"""
Monto AI — Full Screen Animated Face Display v3
Features:
  - True fullscreen on Pi display
  - Smooth emotion transitions (lerp)
  - Particle system (sparkles, hearts, stars, tears)
  - Talking mouth animation
  - Breathing + floating physics
  - Glow halos per emotion
  - Anti-aliased everything
  - 60 FPS double-buffered
"""
import pygame
import pygame.gfxdraw
import math
import random
import threading
from typing import List, Tuple

# ── PALETTE ───────────────────────────────────────────────────────────────────
class C:
    # Backgrounds per emotion
    BG = {
        "idle":      [(8,  10,  30),  (18, 15,  50)],
        "happy":     [(15, 20,  60),  (30, 25,  80)],
        "excited":   [(25, 10,  50),  (50, 20,  90)],
        "sad":       [(10, 15,  35),  (15, 25,  50)],
        "thinking":  [(10, 12,  40),  (20, 18,  60)],
        "surprised": [(20, 10,  45),  (40, 15,  80)],
        "listening": [(8,  18,  45),  (15, 30,  70)],
        "neutral":   [(10, 12,  35),  (20, 18,  55)],
    }
    FACE        = (255, 218,  90)
    FACE_DARK   = (200, 160,  40)
    FACE_LIGHT  = (255, 245, 170)
    EYE         = (20,  20,  50)
    PUPIL       = (50,  70, 200)
    SHINE       = (255, 255, 255)
    MOUTH       = (180,  45,  45)
    MOUTH_IN    = (230,  90,  80)
    TEETH       = (245, 245, 250)
    BLUSH       = (255, 120, 120, 80)
    TEAR        = (120, 190, 255, 220)
    THINK       = (160, 160, 255)
    TEXT_BG     = (8,   10,  30, 200)
    TEXT_FG     = (230, 230, 255)
    WHITE       = (255, 255, 255)
    # Glow colors
    GLOW = {
        "happy":     (255, 220,  80, 35),
        "excited":   (255, 160,  40, 45),
        "sad":       (80,  120, 200, 25),
        "thinking":  (140, 140, 255, 30),
        "surprised": (220, 100, 255, 35),
        "listening": (60,  200, 255, 30),
        "idle":      (100, 100, 200, 20),
        "neutral":   (100, 100, 200, 20),
    }


# ── PARTICLE ──────────────────────────────────────────────────────────────────
class Particle:
    def __init__(self, x, y, kind="star"):
        self.x    = float(x)
        self.y    = float(y)
        self.kind = kind
        self.life = 1.0
        self.size = random.uniform(4, 12)
        angle     = random.uniform(0, math.pi * 2)
        speed     = random.uniform(1.5, 4.0)
        self.vx   = math.cos(angle) * speed
        self.vy   = math.sin(angle) * speed - random.uniform(0.5, 2.0)
        self.rot  = random.uniform(0, math.pi * 2)
        self.rot_speed = random.uniform(-0.15, 0.15)
        colors = {
            "star":    (255, 240,  80),
            "heart":   (255, 100, 150),
            "sparkle": (200, 220, 255),
            "tear":    (120, 190, 255),
            "note":    (150, 255, 180),
        }
        self.color = colors.get(kind, (255, 255, 255))

    def update(self):
        self.x   += self.vx
        self.y   += self.vy
        self.vy  += 0.08   # gravity
        self.life -= 0.018
        self.rot += self.rot_speed
        self.size = max(1, self.size - 0.05)

    def draw(self, surf):
        if self.life <= 0:
            return
        alpha = int(self.life * 255)
        color = (*self.color, alpha)
        s     = max(2, int(self.size))
        x, y  = int(self.x), int(self.y)

        if self.kind == "star":
            self._draw_star(surf, x, y, s, color)
        elif self.kind == "heart":
            self._draw_heart(surf, x, y, s, color)
        elif self.kind == "sparkle":
            self._draw_sparkle(surf, x, y, s, color)
        elif self.kind == "tear":
            pygame.gfxdraw.filled_ellipse(surf, x, y, max(1,s//2), s, color)
        else:
            pygame.gfxdraw.filled_circle(surf, x, y, s, color)

    def _draw_star(self, surf, x, y, size, color):
        pts = []
        for i in range(10):
            a  = math.pi / 5 * i - math.pi / 2 + self.rot
            r  = size if i % 2 == 0 else size // 2
            pts.append((int(x + r * math.cos(a)), int(y + r * math.sin(a))))
        if len(pts) >= 3:
            try:
                pygame.gfxdraw.filled_polygon(surf, pts, color)
            except Exception:
                pass

    def _draw_heart(self, surf, x, y, size, color):
        for i in range(0, 360, 15):
            a  = math.radians(i)
            hx = size * (16 * math.sin(a)**3) / 16
            hy = -size * (13*math.cos(a) - 5*math.cos(2*a) - 2*math.cos(3*a) - math.cos(4*a)) / 16
            pygame.gfxdraw.filled_circle(surf, x + int(hx), y + int(hy), max(1, size//4), color)

    def _draw_sparkle(self, surf, x, y, size, color):
        for a in [0, math.pi/2, math.pi, 3*math.pi/2]:
            ex = x + int(math.cos(a + self.rot) * size)
            ey = y + int(math.sin(a + self.rot) * size)
            pygame.draw.line(surf, color[:3], (x, y), (ex, ey), max(1, size//4))


# ── HELPER FUNCTIONS ──────────────────────────────────────────────────────────
def _aa_circle(surf, color, pos, radius):
    x, y, r = int(pos[0]), int(pos[1]), max(0, int(radius))
    if r < 1:
        return
    pygame.gfxdraw.filled_circle(surf, x, y, r, color)
    pygame.gfxdraw.aacircle(surf, x, y, r, color)


def _lerp(a, b, t):
    return a + (b - a) * t


def _lerp_color(c1, c2, t):
    return tuple(int(_lerp(c1[i], c2[i], t)) for i in range(3))


def _gradient_rect(surf, top_color, bot_color, rect):
    x, y, w, h = rect
    for i in range(h):
        t = i / max(h - 1, 1)
        color = _lerp_color(top_color, bot_color, t)
        pygame.draw.line(surf, color, (x, y + i), (x + w, y + i))


def _glow(surf, color, cx, cy, radius, steps=8):
    s = pygame.Surface((radius * 2 + 80, radius * 2 + 80), pygame.SRCALPHA)
    ox, oy = radius + 40, radius + 40
    for i in range(steps, 0, -1):
        alpha = int(color[3] * (i / steps) ** 2) if len(color) > 3 else 20
        r     = int(radius + (steps - i) * 10)
        c     = (*color[:3], alpha)
        pygame.gfxdraw.filled_circle(s, ox, oy, r, c)
    surf.blit(s, (cx - ox, cy - oy))


# ── MAIN FACE CLASS ───────────────────────────────────────────────────────────
class MontoFace:
    def __init__(self, width=0, height=0, fullscreen=True):
        pygame.init()
        pygame.display.set_caption("Monto AI")

        # Always fullscreen on Pi
        info = pygame.display.Info()
        self.W = info.current_w if fullscreen or width == 0 else width
        self.H = info.current_h if fullscreen or height == 0 else height

        flags = pygame.FULLSCREEN | pygame.HWSURFACE | pygame.DOUBLEBUF
        if not fullscreen and width > 0:
            flags = pygame.HWSURFACE | pygame.DOUBLEBUF
            self.W, self.H = width, height

        self.screen = pygame.display.set_mode((self.W, self.H), flags)
        self.cx     = self.W // 2
        self.cy     = self.H // 2 - int(self.H * 0.05)

        # Face radius — fills ~38% of screen height
        self.base_r = int(min(self.W, self.H) * 0.38)

        # State
        self.emotion      = "idle"
        self.prev_emotion = "idle"
        self.text         = ""
        self.running      = True
        self._lock        = threading.Lock()
        self._tick        = 0
        self._trans_t     = 1.0   # transition 0→1
        self.clock        = pygame.time.Clock()

        # Particles
        self.particles: List[Particle] = []
        self._particle_timer = 0

        # Talking state
        self.talking      = False
        self._talk_tick   = 0

        # Fonts — scale to screen size
        pygame.font.init()
        fs        = max(18, self.H // 22)
        self._font_text  = pygame.font.SysFont("dejavusans", fs)
        self._font_label = pygame.font.SysFont("dejavusans", max(14, self.H // 36), bold=True)
        self._font_big   = pygame.font.SysFont("dejavusans", max(22, self.H // 18), bold=True)

        # Pre-render bg surfaces cache
        self._bg_cache = {}
        self._build_bg("idle")

        pygame.mouse.set_visible(False)

    # ── PUBLIC API ────────────────────────────────────────────────────────────

    def set_emotion(self, emotion: str, text: str = ""):
        with self._lock:
            if emotion != self.emotion:
                self.prev_emotion = self.emotion
                self._trans_t     = 0.0
                self._spawn_particles(emotion)
            self.emotion = emotion.lower().strip()
            self.text    = text
            self._tick   = 0

    def set_talking(self, talking: bool):
        with self._lock:
            self.talking = talking

    def stop(self):
        self.running = False

    def run(self):
        """Main render loop — must be on main thread."""
        while self.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    self.running = False

            with self._lock:
                emotion  = self.emotion
                text     = self.text
                tick     = self._tick
                trans_t  = min(1.0, self._trans_t + 0.05)
                self._trans_t = trans_t
                talking  = self.talking
                parts    = list(self.particles)

            # Draw background
            self._draw_bg(emotion, tick)

            # Update + draw particles
            alive = []
            for p in parts:
                p.update()
                if p.life > 0:
                    p.draw(self.screen)
                    alive.append(p)
            with self._lock:
                self.particles = [p for p in self.particles if p.life > 0]

            # Draw face
            self._draw_face(emotion, tick, trans_t, talking)

            # Text box
            if text:
                self._draw_text_box(text)

            # Emotion label
            self._draw_label(emotion)

            pygame.display.flip()
            self._tick += 1
            self.clock.tick(60)

        pygame.quit()

    # ── BACKGROUND ────────────────────────────────────────────────────────────

    def _build_bg(self, emotion):
        s = pygame.Surface((self.W, self.H))
        colors = C.BG.get(emotion, C.BG["idle"])
        _gradient_rect(s, colors[0], colors[1], (0, 0, self.W, self.H))
        # Subtle grid lines
        for x in range(0, self.W, 60):
            pygame.draw.line(s, (*colors[1], 30)[:3], (x, 0), (x, self.H), 1)
        for y in range(0, self.H, 60):
            pygame.draw.line(s, (*colors[1], 30)[:3], (0, y), (self.W, y), 1)
        self._bg_cache[emotion] = s
        return s

    def _draw_bg(self, emotion, tick):
        if emotion not in self._bg_cache:
            self._build_bg(emotion)
        self.screen.blit(self._bg_cache[emotion], (0, 0))

        # Subtle animated radial pulse from center
        pulse = int(abs(math.sin(tick * 0.02)) * 40)
        r     = int(min(self.W, self.H) * 0.6) + pulse
        glow_col = C.GLOW.get(emotion, (100, 100, 200, 15))
        _glow(self.screen, glow_col, self.cx, self.cy, r, steps=4)

    # ── FACE DISPATCHER ───────────────────────────────────────────────────────

    def _draw_face(self, emotion, tick, trans_t, talking):
        # Floating animation
        float_y = math.sin(tick * 0.035) * int(self.H * 0.012)
        # Breathing
        breath  = 1.0 + math.sin(tick * 0.025) * 0.012
        cy = int(self.cy + float_y)
        cx = self.cx
        r  = int(self.base_r * breath)

        # Glow halo
        glow_col = C.GLOW.get(emotion, (100, 100, 200, 25))
        _glow(self.screen, glow_col, cx, cy, r + 30)

        dispatch = {
            "idle":      self._face_idle,
            "neutral":   self._face_idle,
            "happy":     self._face_happy,
            "excited":   self._face_excited,
            "sad":       self._face_sad,
            "thinking":  self._face_thinking,
            "surprised": self._face_surprised,
            "listening": self._face_listening,
        }
        fn = dispatch.get(emotion, self._face_idle)
        fn(cx, cy, r, tick, talking)

    # ── FACE STATES ───────────────────────────────────────────────────────────

    def _face_idle(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        blink = (tick % 110) < 5
        self._eyes(cx, cy, r, "normal", blink=blink)
        if talking:
            self._mouth_talking(cx, cy, r, tick)
        else:
            self._mouth(cx, cy, r, "slight")

    def _face_happy(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        self._blush(cx, cy, r)
        self._eyes(cx, cy, r, "happy")
        if talking:
            self._mouth_talking(cx, cy, r, tick)
        else:
            self._mouth(cx, cy, r, "big_smile")
        # Animated cheek sparkle
        for i, bx in enumerate([cx - int(r*0.72), cx + int(r*0.72)]):
            a = tick * 0.05 + i * math.pi
            sx = bx + int(math.cos(a) * 15)
            sy = cy + int(r*0.25) + int(math.sin(a) * 8)
            _aa_circle(self.screen, (255, 220, 100, 180), (sx, sy), 4)

    def _face_excited(self, cx, cy, r, tick, talking):
        # Bouncing
        bounce = math.sin(tick * 0.22) * int(r * 0.07)
        ey     = int(cy + bounce)
        self._head(cx, ey, r)
        self._blush(cx, ey, r)
        self._eyes(cx, ey, r, "excited")
        if talking:
            self._mouth_talking(cx, ey, r, tick)
        else:
            self._mouth(cx, ey, r, "open_smile")
        # Orbiting stars
        for i in range(3):
            angle = tick * 0.04 + i * (2 * math.pi / 3)
            dist  = r + 35 + int(math.sin(tick * 0.08 + i) * 8)
            sx    = cx + int(math.cos(angle) * dist)
            sy    = ey + int(math.sin(angle) * dist * 0.6)
            size  = 8 + int(math.sin(tick * 0.1 + i) * 3)
            self._star(sx, sy, size, (255, 240, 80, 220))

    def _face_sad(self, cx, cy, r, tick, talking):
        # Droop down
        self._head(cx, cy + int(r*0.05), r, color=(210, 210, 165))
        self._eyes(cx, cy + int(r*0.05), r, "sad")
        if talking:
            self._mouth_talking(cx, cy + int(r*0.05), r, tick)
        else:
            self._mouth(cx, cy + int(r*0.05), r, "frown")
        # Eyebrows slanted sad
        brow_y = cy - int(r * 0.52)
        lx     = cx - int(r * 0.4)
        rx     = cx + int(r * 0.08)
        pygame.draw.line(self.screen, C.EYE,
                         (lx, brow_y + 8), (lx + int(r*0.32), brow_y), 5)
        pygame.draw.line(self.screen, C.EYE,
                         (rx, brow_y), (rx + int(r*0.32), brow_y + 8), 5)
        # Animated tear
        ty = cy + int(r*0.25) + int(abs(math.sin(tick * 0.06)) * int(r*0.18))
        tx = cx + int(r * 0.38)
        pygame.gfxdraw.filled_ellipse(self.screen, tx, ty, 6, 12, C.TEAR)
        pygame.gfxdraw.aaellipse(self.screen, tx, ty, 6, 12, C.TEAR)

    def _face_thinking(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        self._eyes(cx, cy, r, "thinking")
        if talking:
            self._mouth_talking(cx, cy, r, tick)
        else:
            self._mouth(cx, cy, r, "pressed")
        # Raised eyebrow right
        brow_y = cy - int(r * 0.5)
        pygame.draw.line(self.screen, C.EYE,
                         (cx + int(r*0.12), brow_y - 10),
                         (cx + int(r*0.48), brow_y - 20), 5)
        # Thought bubbles rising
        for i, (ox, oy, br) in enumerate([(int(r*0.5), -int(r*1.0), 9),
                                           (int(r*0.65), -int(r*1.28), 14),
                                           (int(r*0.85), -int(r*1.6), 20)]):
            alpha = int(100 + 120 * abs(math.sin(tick * 0.06 + i * 0.7)))
            _aa_circle(self.screen, (*C.THINK, alpha), (cx + ox, cy + oy), br)

    def _face_surprised(self, cx, cy, r, tick, talking):
        jolt = max(0.0, 1.0 - tick * 0.04) * -int(r * 0.12)
        ey   = int(cy + jolt)
        self._head(cx, ey, r)
        self._eyes(cx, ey, r, "surprised")
        # Brows way up
        brow_y = ey - int(r * 0.52)
        for bx in [cx - int(r*0.42), cx + int(r*0.1)]:
            pygame.draw.arc(self.screen, C.EYE,
                            pygame.Rect(bx, brow_y - 12, int(r*0.35), 22),
                            0, math.pi, 5)
        # O mouth
        mx = cx
        my = ey + int(r * 0.46)
        ow = int(r * 0.2)
        oh = int(r * 0.17)
        pygame.gfxdraw.filled_ellipse(self.screen, mx, my, ow, oh, C.MOUTH)
        pygame.gfxdraw.filled_ellipse(self.screen, mx, my,
                                      max(1, ow - 7), max(1, oh - 6),
                                      (*C.MOUTH_IN, 255))

    def _face_listening(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        self._eyes(cx, cy, r, "normal")
        # Pulsing mouth
        pulse = int(math.sin(tick * 0.16) * int(r * 0.07))
        my    = cy + int(r * 0.43)
        mw    = int(r * 0.18)
        mh    = int(r * 0.1) + pulse
        pygame.gfxdraw.filled_ellipse(self.screen, cx, my, mw, max(2, mh), C.MOUTH)
        # Expanding sound rings
        for i in range(1, 5):
            rr    = r + 15 + i * int(r * 0.15) + pulse
            alpha = max(0, 170 - i * 38)
            rs    = pygame.Surface((rr*2+4, rr*2+4), pygame.SRCALPHA)
            pygame.gfxdraw.aacircle(rs, rr+2, rr+2, rr, (80, 200, 255, alpha))
            self.screen.blit(rs, (cx - rr - 2, cy - rr - 2))

    # ── HEAD ──────────────────────────────────────────────────────────────────

    def _head(self, cx, cy, r, color=None):
        fc = color or C.FACE
        # Drop shadow
        _aa_circle(self.screen, (*C.FACE_DARK, 100), (cx + int(r*0.05), cy + int(r*0.07)), r)
        # Main face
        _aa_circle(self.screen, fc, (cx, cy), r)
        # Inner shading at bottom
        s = pygame.Surface((r*2+2, r*2+2), pygame.SRCALPHA)
        pygame.gfxdraw.filled_ellipse(s, r+1, int(r*1.4), r-6, int(r*0.55),
                                      (*C.FACE_DARK, 35))
        self.screen.blit(s, (cx - r - 1, cy - r - 1))
        # Highlight top-left
        _aa_circle(self.screen, (*C.FACE_LIGHT, 130),
                   (cx - int(r*0.28), cy - int(r*0.28)), int(r*0.32))
        # Outer ring
        pygame.gfxdraw.aacircle(self.screen, cx, cy, r, (*C.FACE_DARK, 180))

    # ── EYES ──────────────────────────────────────────────────────────────────

    def _eyes(self, cx, cy, r, style="normal", blink=False):
        lx  = cx - int(r * 0.32)
        rx  = cx + int(r * 0.32)
        ey  = cy - int(r * 0.13)
        er  = int(r * 0.16)

        if blink:
            for ex in [lx, rx]:
                pygame.draw.line(self.screen, C.EYE,
                                 (ex - er, ey), (ex + er, ey), max(3, er//2))
            return

        if style == "happy":
            for ex in [lx, rx]:
                pygame.draw.arc(self.screen, C.EYE,
                                pygame.Rect(ex-er, ey-3, er*2, er*2),
                                math.pi, 2*math.pi, max(3, er//2))
            return

        if style == "sad":
            for ex in [lx, rx]:
                pygame.draw.arc(self.screen, C.EYE,
                                pygame.Rect(ex-er, ey-er//2, er*2, er*2),
                                0, math.pi, max(3, er//2))
            return

        if style == "thinking":
            pygame.draw.line(self.screen, C.EYE,
                             (lx-er, ey+4), (lx+er, ey+4), max(3, er//2))
            self._eye_full(rx, ey, er)
            return

        if style == "excited":
            for ex in [lx, rx]:
                self._eye_full(ex, ey, int(er*1.3))
            return

        if style == "surprised":
            for ex in [lx, rx]:
                self._eye_full(ex, ey, int(er*1.5))
            return

        for ex in [lx, rx]:
            self._eye_full(ex, ey, er)

    def _eye_full(self, ex, ey, er):
        _aa_circle(self.screen, C.EYE,   (ex, ey),            er)
        _aa_circle(self.screen, C.PUPIL, (ex+2, ey+2),        max(3, int(er*0.52)))
        _aa_circle(self.screen, C.SHINE, (ex+int(er*0.38), ey-int(er*0.38)),
                   max(2, int(er*0.28)))

    # ── MOUTH ─────────────────────────────────────────────────────────────────

    def _mouth(self, cx, cy, r, style="slight"):
        my = cy + int(r * 0.44)
        mw = int(r * 0.52)
        mh = int(r * 0.20)

        if style == "big_smile":
            rect = pygame.Rect(cx-mw, my-mh, mw*2, mh*2)
            pygame.draw.arc(self.screen, C.MOUTH, rect, math.pi, 2*math.pi, max(3, mh//3))
            # Teeth
            tr = pygame.Rect(cx-mw+8, my-3, mw*2-16, mh-4)
            pygame.draw.rect(self.screen, C.TEETH, tr, border_radius=6)
            return

        if style == "slight":
            rect = pygame.Rect(cx-int(mw*0.6), my-int(mh*0.5), int(mw*1.2), int(mh*1.2))
            pygame.draw.arc(self.screen, C.MOUTH, rect, math.pi, 2*math.pi, 4)
            return

        if style == "frown":
            rect = pygame.Rect(cx-int(mw*0.65), my+4, int(mw*1.3), int(mh*1.1))
            pygame.draw.arc(self.screen, C.MOUTH, rect, 0, math.pi, 5)
            return

        if style == "pressed":
            pygame.draw.line(self.screen, C.MOUTH,
                             (cx-int(mw*0.45), my+8), (cx+int(mw*0.45), my+8), 5)
            return

        if style == "open_smile":
            rect = pygame.Rect(cx-mw, my-mh, mw*2, mh*2)
            pygame.draw.arc(self.screen, C.MOUTH, rect, math.pi, 2*math.pi, 5)
            pygame.gfxdraw.filled_ellipse(self.screen, cx, my+4,
                                          mw-8, max(2, mh//2), C.MOUTH_IN)
            return

    def _mouth_talking(self, cx, cy, r, tick):
        """Animated talking mouth — opens and closes."""
        my  = cy + int(r * 0.44)
        mw  = int(r * 0.38)
        opening = abs(math.sin(tick * 0.25))
        mh  = max(3, int(r * 0.04 + r * 0.16 * opening))
        pygame.gfxdraw.filled_ellipse(self.screen, cx, my, mw, mh, C.MOUTH)
        if opening > 0.3:
            # Show teeth when mouth is more open
            pygame.gfxdraw.filled_ellipse(self.screen, cx, my,
                                          max(2, mw-6), max(2, mh-3), C.TEETH)
            pygame.gfxdraw.filled_ellipse(self.screen, cx, my + max(2, mh//2),
                                          max(2, mw-8), max(2, mh//2), C.MOUTH_IN)

    # ── BLUSH ─────────────────────────────────────────────────────────────────

    def _blush(self, cx, cy, r):
        for bx in [cx - int(r*0.68), cx + int(r*0.68)]:
            s = pygame.Surface((int(r*0.45)+4, int(r*0.22)+4), pygame.SRCALPHA)
            bw, bh = int(r*0.22), int(r*0.1)
            pygame.gfxdraw.filled_ellipse(s, bw+2, bh+2, bw, bh, C.BLUSH)
            self.screen.blit(s, (bx - bw - 2, cy + int(r*0.2)))

    # ── STAR ──────────────────────────────────────────────────────────────────

    def _star(self, x, y, size, color):
        pts = []
        for i in range(10):
            a  = math.pi / 5 * i - math.pi / 2
            ro = size if i % 2 == 0 else size // 2
            pts.append((int(x + ro * math.cos(a)), int(y + ro * math.sin(a))))
        if len(pts) >= 3:
            try:
                pygame.gfxdraw.filled_polygon(self.screen, pts, color)
                pygame.gfxdraw.aapolygon(self.screen, pts, color[:3])
            except Exception:
                pass

    # ── PARTICLES ─────────────────────────────────────────────────────────────

    def _spawn_particles(self, emotion):
        cx, cy = self.cx, self.cy
        r      = self.base_r
        kind_map = {
            "happy":     ("star",    20),
            "excited":   ("sparkle", 30),
            "sad":       ("tear",    8),
            "surprised": ("sparkle", 15),
            "listening": ("note",    10),
        }
        kind, count = kind_map.get(emotion, (None, 0))
        if not kind:
            return
        for _ in range(count):
            angle  = random.uniform(0, math.pi * 2)
            dist   = random.uniform(r * 0.3, r * 1.1)
            px     = cx + math.cos(angle) * dist
            py     = cy + math.sin(angle) * dist
            self.particles.append(Particle(px, py, kind))

    # ── TEXT BOX ──────────────────────────────────────────────────────────────

    def _draw_text_box(self, text):
        max_w = self.W - int(self.W * 0.08)
        words = text.split()
        lines, line = [], ""
        for word in words:
            test = (line + " " + word).strip()
            if self._font_text.size(test)[0] <= max_w:
                line = test
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)

        lh    = int(self.H * 0.045)
        pad   = int(self.H * 0.025)
        box_h = len(lines) * lh + pad * 2
        box_w = max_w + pad * 2
        box_y = self.H - box_h - int(self.H * 0.03)
        box_x = (self.W - box_w) // 2

        # Frosted glass background
        box = pygame.Surface((box_w, box_h), pygame.SRCALPHA)
        pygame.draw.rect(box, C.TEXT_BG, box.get_rect(), border_radius=20)
        pygame.draw.rect(box, (255, 255, 255, 30), box.get_rect(),
                         width=2, border_radius=20)
        self.screen.blit(box, (box_x, box_y))

        y = box_y + pad
        for l in lines:
            surf = self._font_text.render(l, True, C.TEXT_FG)
            self.screen.blit(surf, ((self.W - surf.get_width()) // 2, y))
            y += lh

    # ── LABEL ─────────────────────────────────────────────────────────────────

    def _draw_label(self, emotion):
        icons = {
            "happy":     "😊 HAPPY",
            "sad":       "😢 SAD",
            "thinking":  "🤔 THINKING",
            "excited":   "🤩 EXCITED",
            "surprised": "😲 SURPRISED",
            "listening": "👂 LISTENING",
            "neutral":   "😐 NEUTRAL",
            "idle":      "✨ MONTO",
        }
        label = icons.get(emotion, "✨ MONTO")
        # Background pill
        surf  = self._font_label.render(label, True, (180, 180, 255))
        pad   = 10
        pill  = pygame.Surface((surf.get_width() + pad*2, surf.get_height() + pad), pygame.SRCALPHA)
        pygame.draw.rect(pill, (20, 20, 60, 160), pill.get_rect(), border_radius=20)
        self.screen.blit(pill, (12, 12))
        self.screen.blit(surf, (12 + pad, 12 + pad // 2))
