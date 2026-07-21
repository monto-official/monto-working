"""
Monto AI — Full Screen Display v4
Professional UI with:
  - True fullscreen auto-launch
  - Beautiful MONTO branding
  - Improved face character design
  - Smooth particle system
  - Status bar at bottom
  - 60 FPS
"""
import pygame
import pygame.gfxdraw
import math
import random
import threading
from typing import List

# ── THEME ─────────────────────────────────────────────────────────────────────
class Theme:
    # Dark space background
    BG_TOP   = (8,   6,  28)
    BG_BOT   = (18, 14,  52)

    # Emotion-based accent colors
    ACCENT = {
        "idle":      (100, 80,  220),
        "neutral":   (100, 80,  220),
        "happy":     (255, 200,  60),
        "excited":   (255, 120,  40),
        "sad":       (60,  120, 220),
        "thinking":  (120, 100, 255),
        "surprised": (220,  80, 255),
        "listening": (40,  200, 255),
    }

    # Face
    FACE       = (255, 215,  85)
    FACE_SHADE = (200, 158,  35)
    FACE_HIGH  = (255, 248, 180)

    # Features
    EYE        = (15,  12,  45)
    PUPIL      = (60,  80, 210)
    SHINE      = (255, 255, 255)
    MOUTH      = (185,  40,  55)
    MOUTH_DARK = (140,  25,  40)
    TEETH      = (248, 248, 252)
    BLUSH      = (255, 110, 110, 70)
    TEAR       = (100, 180, 255, 200)
    BUBBLE     = (160, 155, 255)

    # UI
    TEXT_FG    = (235, 232, 255)
    TEXT_DIM   = (140, 130, 200)
    CARD_BG    = (12,  10,  38, 210)
    CARD_EDGE  = (255, 255, 255, 25)
    LOGO_MAIN  = (255, 245, 120)
    LOGO_GLOW  = (200, 180, 255)

    @classmethod
    def accent(cls, emotion):
        return cls.ACCENT.get(emotion, cls.ACCENT["idle"])


# ── PARTICLE ──────────────────────────────────────────────────────────────────
class Particle:
    COLORS = {
        "star":    (255, 240,  80),
        "sparkle": (210, 200, 255),
        "heart":   (255, 100, 150),
        "tear":    (100, 180, 255),
        "bubble":  (160, 155, 255),
        "note":    (120, 255, 160),
    }

    def __init__(self, x, y, kind="star"):
        self.x    = float(x)
        self.y    = float(y)
        self.kind = kind
        self.life = 1.0
        self.max_life = 1.0
        angle = random.uniform(0, math.pi * 2)
        speed = random.uniform(1.2, 3.5)
        self.vx = math.cos(angle) * speed
        self.vy = math.sin(angle) * speed - random.uniform(0.3, 1.8)
        self.size = random.uniform(5, 13)
        self.rot  = random.uniform(0, math.pi * 2)
        self.rot_v = random.uniform(-0.12, 0.12)
        self.color = self.COLORS.get(kind, (255, 255, 255))

    def update(self):
        self.x   += self.vx
        self.y   += self.vy
        self.vy  += 0.07
        self.life -= 0.016
        self.rot += self.rot_v
        self.size = max(1, self.size * 0.985)

    @property
    def alpha(self):
        return int(min(255, self.life * 300))

    def draw(self, surf):
        if self.life <= 0: return
        c = (*self.color, self.alpha)
        x, y, s = int(self.x), int(self.y), max(2, int(self.size))
        try:
            if self.kind == "star":
                pts = [(int(x + (s if i%2==0 else s//2) * math.cos(math.pi/5*i - math.pi/2 + self.rot)),
                        int(y + (s if i%2==0 else s//2) * math.sin(math.pi/5*i - math.pi/2 + self.rot)))
                       for i in range(10)]
                pygame.gfxdraw.filled_polygon(surf, pts, c)
            elif self.kind == "sparkle":
                for a in [self.rot, self.rot + math.pi/2]:
                    ex, ey = x + int(math.cos(a)*s), y + int(math.sin(a)*s)
                    pygame.draw.line(surf, c[:3], (x,y), (ex,ey), max(1,s//3))
            elif self.kind == "heart":
                pygame.gfxdraw.filled_circle(surf, x - s//3, y, max(1,s//2), c)
                pygame.gfxdraw.filled_circle(surf, x + s//3, y, max(1,s//2), c)
                pts2 = [(x, y+s), (x-s, y), (x, y-s//3), (x+s, y)]
                pygame.gfxdraw.filled_polygon(surf, pts2, c)
            else:
                pygame.gfxdraw.filled_circle(surf, x, y, s, c)
                pygame.gfxdraw.aacircle(surf, x, y, s, c)
        except Exception:
            pass


# ── HELPERS ───────────────────────────────────────────────────────────────────
def aa_circle(surf, color, pos, r):
    x, y, r = int(pos[0]), int(pos[1]), max(0, int(r))
    if r < 1: return
    pygame.gfxdraw.filled_circle(surf, x, y, r, color)
    pygame.gfxdraw.aacircle(surf, x, y, r, color)


def gradient_fill(surf, top, bot, rect=None):
    w, h = surf.get_size()
    rx, ry, rw, rh = rect or (0, 0, w, h)
    for i in range(rh):
        t = i / max(rh-1, 1)
        c = tuple(int(top[j] + (bot[j]-top[j])*t) for j in range(3))
        pygame.draw.line(surf, c, (rx, ry+i), (rx+rw, ry+i))


def glow(surf, color, cx, cy, r, steps=7):
    s = pygame.Surface((r*2+60, r*2+60), pygame.SRCALPHA)
    ox, oy = r+30, r+30
    a3 = color[3] if len(color) > 3 else 30
    for i in range(steps, 0, -1):
        a = int(a3 * (i/steps)**1.8)
        pygame.gfxdraw.filled_circle(s, ox, oy, int(r + (steps-i)*9), (*color[:3], a))
    surf.blit(s, (cx-ox, cy-oy))


# ── MAIN CLASS ────────────────────────────────────────────────────────────────
class MontoFace:
    def __init__(self, width=0, height=0, fullscreen=True):
        pygame.init()
        pygame.display.set_caption("Monto AI")

        info = pygame.display.Info()
        if fullscreen or width == 0:
            self.W, self.H = info.current_w, info.current_h
            flags = pygame.FULLSCREEN | pygame.HWSURFACE | pygame.DOUBLEBUF
        else:
            self.W, self.H = width, height
            flags = pygame.HWSURFACE | pygame.DOUBLEBUF

        self.screen = pygame.display.set_mode((self.W, self.H), flags)
        pygame.mouse.set_visible(False)

        # Layout zones
        self.logo_h  = int(self.H * 0.22)   # top 22% — logo (taller now)
        self.face_cy = int(self.H * 0.53)   # face center at 53%
        self.face_cx = self.W // 2
        self.face_r  = int(min(self.W, self.H) * 0.27)  # face radius

        # State
        self.emotion   = "idle"
        self.text      = ""
        self.talking   = False
        self.running   = True
        self.mic_level = 0.0   # 0.0-1.0 live mic input level
        self._lock     = threading.Lock()
        self._tick     = 0
        self.clock     = pygame.time.Clock()
        self.particles: List[Particle] = []

        # Fonts
        pygame.font.init()
        self._f_logo   = pygame.font.SysFont("dejavusansbold",  max(32, self.H//14), bold=True)
        self._f_sub    = pygame.font.SysFont("dejavusans",      max(14, self.H//38))
        self._f_text   = pygame.font.SysFont("dejavusans",      max(18, self.H//24))
        self._f_status = pygame.font.SysFont("dejavusans",      max(14, self.H//40))

        # Pre-render static background
        self._bg = pygame.Surface((self.W, self.H))
        gradient_fill(self._bg, Theme.BG_TOP, Theme.BG_BOT)
        self._draw_bg_stars()
        self._bg_cached = self._bg.copy()

    def _draw_bg_stars(self):
        """Draw subtle static stars on background."""
        rng = random.Random(42)  # fixed seed = same stars always
        for _ in range(80):
            x = rng.randint(0, self.W)
            y = rng.randint(0, self.H)
            r = rng.randint(1, 2)
            a = rng.randint(40, 160)
            pygame.gfxdraw.filled_circle(self._bg, x, y, r, (200, 200, 255, a))

    # ── PUBLIC API ────────────────────────────────────────────────────────────

    def set_emotion(self, emotion: str, text: str = ""):
        with self._lock:
            prev = self.emotion
            self.emotion = emotion.lower().strip()
            self.text    = text
            self._tick   = 0
            if emotion != prev:
                self._spawn_particles(emotion)

    def set_talking(self, talking: bool):
        with self._lock:
            self.talking = talking

    def set_mic_level(self, level: float):
        """Set live mic level 0.0-1.0 for listening animation."""
        with self._lock:
            self.mic_level = max(0.0, min(1.0, level))

    def stop(self):
        self.running = False

    def run(self):
        while self.running:
            for e in pygame.event.get():
                if e.type == pygame.QUIT: self.running = False
                if e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE: self.running = False

            with self._lock:
                emotion   = self.emotion
                text      = self.text
                tick      = self._tick
                talking   = self.talking
                mic_level = self.mic_level
                parts     = list(self.particles)

            # ── Background
            self.screen.blit(self._bg_cached, (0, 0))

            # ── Ambient glow
            acc = Theme.accent(emotion)
            glow(self.screen, (*acc, 22), self.face_cx, self.face_cy,
                 int(min(self.W, self.H) * 0.55), steps=5)

            # ── Particles
            for p in parts:
                p.update()
                p.draw(self.screen)
            with self._lock:
                self.particles = [p for p in self.particles if p.life > 0]

            # ── Logo
            self._draw_logo(emotion, tick)

            # ── Face
            self._draw_face(emotion, tick, talking)

            # ── Live mic visualizer (listening state)
            if emotion == "listening":
                self._draw_mic_visualizer(mic_level, tick)

            # ── Speaking indicator (talking state)
            if talking:
                self._draw_speaking_indicator(tick)

            # ── Text card
            if text:
                self._draw_text_card(text, emotion)

            # ── Status bar
            self._draw_status_bar(emotion, mic_level)

            pygame.display.flip()
            self._tick += 1
            self.clock.tick(60)

        pygame.quit()

    # ── LOGO ──────────────────────────────────────────────────────────────────

    def _draw_logo(self, emotion, tick):
        acc = Theme.accent(emotion)
        cy  = int(self.logo_h * 0.48)

        # Animated glow behind text
        pulse = 0.7 + 0.3 * abs(math.sin(tick * 0.03))
        glow(self.screen, (*acc, int(28 * pulse)), self.face_cx, cy,
             int(self.W * 0.32), steps=4)

        # ── "MONTO KIDS" main title ───────────────────────────────────────────
        shadow = self._f_logo.render("MONTO KIDS", True, (5, 3, 20))
        sx = (self.W - shadow.get_width()) // 2
        self.screen.blit(shadow, (sx + 3, cy - shadow.get_height()//2 + 3))

        # Layered glow effect
        for col, off in [((*(c//2 for c in acc), 255), 1),
                         (Theme.LOGO_GLOW, 0),
                         (Theme.LOGO_MAIN, 0)]:
            t = self._f_logo.render("MONTO KIDS", True, col[:3])
            self.screen.blit(t, ((self.W - t.get_width()) // 2 + off,
                                  cy - t.get_height()//2 + off))

        title_bottom = cy + self._f_logo.get_height()//2

        # ── Animated separator dots ───────────────────────────────────────────
        sep_y    = title_bottom + 6
        dot_cols = [(255,200,80), (200,180,255), (80,200,255),
                    (255,120,160), (120,255,180)]
        dot_total = len(dot_cols)
        dot_gap   = int(self.W * 0.018)
        dot_start = self.face_cx - (dot_total * dot_gap) // 2

        for i, dc in enumerate(dot_cols):
            bounce = int(math.sin(tick * 0.08 + i * 0.7) * 3)
            r_dot  = 4 + (1 if i == tick // 8 % dot_total else 0)
            pygame.gfxdraw.filled_circle(
                self.screen,
                dot_start + i * dot_gap,
                sep_y + bounce,
                r_dot,
                (*dc, 200)
            )
            pygame.gfxdraw.aacircle(
                self.screen,
                dot_start + i * dot_gap,
                sep_y + bounce,
                r_dot,
                (*dc, 200)
            )

        # ── "AI Sathi" subtitle ───────────────────────────────────────────────
        sub_y    = sep_y + 12
        sub_text = "AI Sathi  ✦"

        # Animated color shift for subtitle
        r_s = int(160 + 60 * math.sin(tick * 0.04))
        g_s = int(140 + 60 * math.sin(tick * 0.04 + 2.1))
        b_s = int(220 + 30 * math.sin(tick * 0.04 + 4.2))
        sub_col = (min(255,r_s), min(255,g_s), min(255,b_s))

        sub = self._f_sub.render(sub_text, True, sub_col)
        self.screen.blit(sub, ((self.W - sub.get_width()) // 2, sub_y))

        # ── Thin accent line ──────────────────────────────────────────────────
        ly = sub_y + self._f_sub.get_height() + 6
        lw = int(self.W * 0.22)
        for ox, w2, a in [(-lw//2 - 40, lw + 80, 25), (-lw//2, lw, 110)]:
            s = pygame.Surface((w2, 2), pygame.SRCALPHA)
            pygame.draw.line(s, (*acc, a), (0, 1), (w2, 1), 2)
            self.screen.blit(s, (self.face_cx + ox, ly))

    # ── FACE ──────────────────────────────────────────────────────────────────

    def _draw_face(self, emotion, tick, talking):
        float_y = math.sin(tick * 0.033) * int(self.H * 0.010)
        breath  = 1.0 + math.sin(tick * 0.022) * 0.010
        cx = self.face_cx
        cy = int(self.face_cy + float_y)
        r  = int(self.face_r * breath)

        acc = Theme.accent(emotion)
        glow(self.screen, (*acc, 30), cx, cy, r + 25, steps=6)

        dispatch = {
            "happy":     self._e_happy,
            "excited":   self._e_excited,
            "sad":       self._e_sad,
            "thinking":  self._e_thinking,
            "surprised": self._e_surprised,
            "listening": self._e_listening,
        }
        fn = dispatch.get(emotion, self._e_idle)
        fn(cx, cy, r, tick, talking)

    # ── EMOTION FACES ─────────────────────────────────────────────────────────

    def _e_idle(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        self._eyes(cx, cy, r, "normal", blink=(tick % 120) < 5)
        self._eyebrows(cx, cy, r, "normal")
        self._mouth_talking(cx, cy, r, tick) if talking else self._mouth(cx, cy, r, "slight")

    def _e_happy(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        self._blush(cx, cy, r)
        self._eyes(cx, cy, r, "happy")
        self._eyebrows(cx, cy, r, "happy")
        self._mouth_talking(cx, cy, r, tick) if talking else self._mouth(cx, cy, r, "big_smile")
        # Rosy cheek sparkles
        for i, bx in enumerate([cx - int(r*.70), cx + int(r*.70)]):
            a  = tick * 0.04 + i * math.pi
            sx = bx + int(math.cos(a) * 12)
            sy = cy + int(r*.22) + int(math.sin(a) * 7)
            aa_circle(self.screen, (255, 215, 90, 160), (sx, sy), 4)

    def _e_excited(self, cx, cy, r, tick, talking):
        b  = math.sin(tick * 0.20) * int(r * 0.06)
        ey = int(cy + b)
        self._head(cx, ey, r)
        self._blush(cx, ey, r)
        self._eyes(cx, ey, r, "excited")
        self._eyebrows(cx, ey, r, "excited")
        self._mouth_talking(cx, ey, r, tick) if talking else self._mouth(cx, ey, r, "open_smile")
        # Orbiting sparkles
        for i in range(4):
            angle = tick * 0.045 + i * math.pi / 2
            d     = r + 28 + int(math.sin(tick * 0.07 + i) * 6)
            sx    = cx + int(math.cos(angle) * d)
            sy    = ey + int(math.sin(angle) * d * 0.55)
            sz    = 7 + int(math.sin(tick * 0.09 + i) * 3)
            self._star(sx, sy, sz, (255, 240, 80, 210))

    def _e_sad(self, cx, cy, r, tick, talking):
        dy = int(r * 0.04)
        self._head(cx, cy + dy, r, color=(208, 208, 158))
        self._eyes(cx, cy + dy, r, "sad")
        self._eyebrows(cx, cy + dy, r, "sad")
        self._mouth_talking(cx, cy+dy, r, tick) if talking else self._mouth(cx, cy+dy, r, "frown")
        # Tear
        ty = cy + int(r*.20) + int(abs(math.sin(tick*.055)) * int(r*.16))
        tx = cx + int(r*.40)
        pygame.gfxdraw.filled_ellipse(self.screen, tx, ty, 5, 11, Theme.TEAR)
        pygame.gfxdraw.aaellipse(self.screen, tx, ty, 5, 11, Theme.TEAR)

    def _e_thinking(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        self._eyes(cx, cy, r, "thinking")
        self._eyebrows(cx, cy, r, "thinking")
        self._mouth_talking(cx, cy, r, tick) if talking else self._mouth(cx, cy, r, "pressed")
        # Thought bubbles
        for i, (ox, oy, br) in enumerate([
            (int(r*.48), -int(r*.95), 8),
            (int(r*.64), -int(r*1.22), 13),
            (int(r*.82), -int(r*1.52), 19),
        ]):
            a = int(80 + 120 * abs(math.sin(tick * 0.055 + i * 0.7)))
            aa_circle(self.screen, (*Theme.BUBBLE, a), (cx+ox, cy+oy), br)

    def _e_surprised(self, cx, cy, r, tick, talking):
        jolt = max(0.0, 1.0 - tick * 0.045) * -int(r * .10)
        ey   = int(cy + jolt)
        self._head(cx, ey, r)
        self._eyes(cx, ey, r, "surprised")
        self._eyebrows(cx, ey, r, "surprised")
        # O mouth
        mx, my = cx, ey + int(r*.44)
        ow, oh = int(r*.18), int(r*.15)
        pygame.gfxdraw.filled_ellipse(self.screen, mx, my, ow, oh, Theme.MOUTH)
        pygame.gfxdraw.filled_ellipse(self.screen, mx, my,
                                      max(1,ow-6), max(1,oh-5), Theme.MOUTH_DARK)

    def _e_listening(self, cx, cy, r, tick, talking):
        self._head(cx, cy, r)
        self._eyes(cx, cy, r, "normal")
        self._eyebrows(cx, cy, r, "normal")
        # Pulsing mouth
        pulse = int(math.sin(tick * 0.15) * int(r * .06))
        my    = cy + int(r * .42)
        mw, mh = int(r*.17), max(3, int(r*.09) + pulse)
        pygame.gfxdraw.filled_ellipse(self.screen, cx, my, mw, mh, Theme.MOUTH)
        # Sound rings
        for i in range(1, 5):
            rr    = r + 12 + i * int(r*.14) + pulse
            alpha = max(0, 160 - i * 36)
            rs    = pygame.Surface((rr*2+4, rr*2+4), pygame.SRCALPHA)
            pygame.gfxdraw.aacircle(rs, rr+2, rr+2, rr, (60, 200, 255, alpha))
            self.screen.blit(rs, (cx-rr-2, cy-rr-2))

    # ── HEAD ──────────────────────────────────────────────────────────────────

    def _head(self, cx, cy, r, color=None):
        fc = color or Theme.FACE
        # Drop shadow
        aa_circle(self.screen, (*Theme.FACE_SHADE, 90), (cx+int(r*.045), cy+int(r*.06)), r)
        # Main
        aa_circle(self.screen, fc, (cx, cy), r)
        # Bottom shade
        s = pygame.Surface((r*2+2, r*2+2), pygame.SRCALPHA)
        pygame.gfxdraw.filled_ellipse(s, r+1, int(r*1.38), r-4, int(r*.52),
                                      (*Theme.FACE_SHADE, 30))
        self.screen.blit(s, (cx-r-1, cy-r-1))
        # Highlight
        aa_circle(self.screen, (*Theme.FACE_HIGH, 120),
                  (cx - int(r*.26), cy - int(r*.26)), int(r*.30))
        # Outline
        pygame.gfxdraw.aacircle(self.screen, cx, cy, r, (*Theme.FACE_SHADE, 160))

    # ── EYEBROWS ──────────────────────────────────────────────────────────────

    def _eyebrows(self, cx, cy, r, style):
        lx = cx - int(r*.32)
        rx = cx + int(r*.32)
        by = cy - int(r*.50)
        w  = int(r*.30)
        h  = 5

        shapes = {
            "normal":    [(lx-w//2, by,   lx+w//2, by-2),
                          (rx-w//2, by-2, rx+w//2, by)],
            "happy":     [(lx-w//2, by+2, lx+w//2, by-2),
                          (rx-w//2, by-2, rx+w//2, by+2)],
            "sad":       [(lx-w//2, by-4, lx+w//2, by+2),
                          (rx-w//2, by+2, rx+w//2, by-4)],
            "thinking":  [(lx-w//2, by,   lx+w//2, by-2),
                          (rx-w//2, by-6, rx+w//2, by-2)],
            "surprised": [(lx-w//2, by-6, lx+w//2, by-4),
                          (rx-w//2, by-4, rx+w//2, by-6)],
            "excited":   [(lx-w//2, by+2, lx+w//2, by-3),
                          (rx-w//2, by-3, rx+w//2, by+2)],
        }

        for (x1, y1, x2, y2) in shapes.get(style, shapes["normal"]):
            pygame.draw.line(self.screen, Theme.EYE, (x1, y1), (x2, y2), h)
            # AA ends
            pygame.gfxdraw.aacircle(self.screen, x1, y1, h//2, Theme.EYE)
            pygame.gfxdraw.aacircle(self.screen, x2, y2, h//2, Theme.EYE)

    # ── EYES ──────────────────────────────────────────────────────────────────

    def _eyes(self, cx, cy, r, style, blink=False):
        lx = cx - int(r*.32)
        rx = cx + int(r*.32)
        ey = cy - int(r*.12)
        er = int(r*.155)

        if blink:
            for ex in [lx, rx]:
                pygame.draw.line(self.screen, Theme.EYE,
                                 (ex-er, ey), (ex+er, ey), max(3, er//2))
            return

        styles = {
            "happy":     lambda ex: pygame.draw.arc(self.screen, Theme.EYE,
                             pygame.Rect(ex-er, ey-2, er*2, er*2), math.pi, 2*math.pi, max(3,er//2)),
            "sad":       lambda ex: pygame.draw.arc(self.screen, Theme.EYE,
                             pygame.Rect(ex-er, ey-er//2, er*2, er*2), 0, math.pi, max(3,er//2)),
            "thinking":  None,
            "excited":   lambda ex: self._eye_full(ex, ey, int(er*1.25)),
            "surprised": lambda ex: self._eye_full(ex, ey, int(er*1.45)),
        }

        if style == "thinking":
            pygame.draw.line(self.screen, Theme.EYE,
                             (lx-er, ey+3), (lx+er, ey+3), max(3, er//2))
            self._eye_full(rx, ey, er)
            return

        fn = styles.get(style)
        if fn:
            for ex in [lx, rx]: fn(ex)
        else:
            for ex in [lx, rx]: self._eye_full(ex, ey, er)

    def _eye_full(self, ex, ey, er):
        aa_circle(self.screen, Theme.EYE,   (ex, ey),                  er)
        aa_circle(self.screen, Theme.PUPIL, (ex+2, ey+2),              max(3, int(er*.50)))
        aa_circle(self.screen, Theme.SHINE, (ex+int(er*.36), ey-int(er*.36)), max(2, int(er*.26)))
        # Small second shine
        aa_circle(self.screen, (*Theme.SHINE, 180),
                  (ex-int(er*.20), ey+int(er*.30)), max(1, int(er*.14)))

    # ── MOUTH ─────────────────────────────────────────────────────────────────

    def _mouth(self, cx, cy, r, style):
        my = cy + int(r * .43)
        mw = int(r * .50)
        mh = int(r * .19)

        if style == "big_smile":
            rect = pygame.Rect(cx-mw, my-mh, mw*2, mh*2)
            pygame.draw.arc(self.screen, Theme.MOUTH, rect, math.pi, 2*math.pi, max(3, mh//3))
            tr = pygame.Rect(cx-mw+8, my-2, mw*2-16, mh-3)
            pygame.draw.rect(self.screen, Theme.TEETH, tr, border_radius=7)
        elif style == "slight":
            rect = pygame.Rect(cx-int(mw*.58), my-int(mh*.5), int(mw*1.16), int(mh*1.15))
            pygame.draw.arc(self.screen, Theme.MOUTH, rect, math.pi, 2*math.pi, 4)
        elif style == "frown":
            rect = pygame.Rect(cx-int(mw*.62), my+3, int(mw*1.24), int(mh*1.05))
            pygame.draw.arc(self.screen, Theme.MOUTH, rect, 0, math.pi, 5)
        elif style == "pressed":
            pygame.draw.line(self.screen, Theme.MOUTH,
                             (cx-int(mw*.42), my+7), (cx+int(mw*.42), my+7), 5)
        elif style == "open_smile":
            rect = pygame.Rect(cx-mw, my-mh, mw*2, mh*2)
            pygame.draw.arc(self.screen, Theme.MOUTH, rect, math.pi, 2*math.pi, 5)
            pygame.gfxdraw.filled_ellipse(self.screen, cx, my+3, mw-7, max(2,mh//2), Theme.MOUTH_DARK)

    def _mouth_talking(self, cx, cy, r, tick):
        my   = cy + int(r * .43)
        mw   = int(r * .36)
        op   = abs(math.sin(tick * 0.24))
        mh   = max(3, int(r * .04 + r * .15 * op))
        pygame.gfxdraw.filled_ellipse(self.screen, cx, my, mw, mh, Theme.MOUTH)
        if op > 0.25:
            pygame.gfxdraw.filled_ellipse(self.screen, cx, my,
                                          max(2,mw-5), max(2,mh-2), Theme.TEETH)
            pygame.gfxdraw.filled_ellipse(self.screen, cx, my+max(2,mh//2),
                                          max(2,mw-7), max(2,mh//2), Theme.MOUTH_DARK)

    # ── BLUSH ─────────────────────────────────────────────────────────────────

    def _blush(self, cx, cy, r):
        for bx in [cx - int(r*.67), cx + int(r*.67)]:
            s  = pygame.Surface((int(r*.42)+4, int(r*.21)+4), pygame.SRCALPHA)
            bw = int(r*.20)
            bh = int(r*.09)
            pygame.gfxdraw.filled_ellipse(s, bw+2, bh+2, bw, bh, Theme.BLUSH)
            self.screen.blit(s, (bx-bw-2, cy+int(r*.19)))

    # ── STAR ──────────────────────────────────────────────────────────────────

    def _star(self, x, y, size, color):
        pts = [(int(x + (size if i%2==0 else size//2) * math.cos(math.pi/5*i - math.pi/2)),
                int(y + (size if i%2==0 else size//2) * math.sin(math.pi/5*i - math.pi/2)))
               for i in range(10)]
        try:
            pygame.gfxdraw.filled_polygon(self.screen, pts, color)
            pygame.gfxdraw.aapolygon(self.screen, pts, color[:3])
        except Exception:
            pass

    # ── PARTICLES ─────────────────────────────────────────────────────────────

    def _spawn_particles(self, emotion):
        cx, cy, r = self.face_cx, self.face_cy, self.face_r
        cfg = {
            "happy":     ("star",    18),
            "excited":   ("sparkle", 28),
            "sad":       ("tear",    6),
            "surprised": ("sparkle", 14),
            "listening": ("bubble",  10),
        }
        kind, count = cfg.get(emotion, (None, 0))
        if not kind: return
        for _ in range(count):
            a = random.uniform(0, math.pi*2)
            d = random.uniform(r*.2, r*1.0)
            self.particles.append(Particle(cx + math.cos(a)*d, cy + math.sin(a)*d, kind))

    # ── MIC VISUALIZER ────────────────────────────────────────────────────────

    def _draw_mic_visualizer(self, mic_level: float, tick: int):
        """Show live audio waveform bars above the status bar during listening."""
        bar_count = 24
        bar_w     = int(self.W * 0.018)
        gap       = int(self.W * 0.008)
        total_w   = bar_count * (bar_w + gap)
        start_x   = (self.W - total_w) // 2
        # Position above status bar (status bar is 5.5% from bottom)
        base_y    = self.H - int(self.H * 0.065) - int(self.H * 0.055)
        max_h     = int(self.H * 0.07)

        for i in range(bar_count):
            wave  = abs(math.sin(tick * 0.12 + i * 0.4)) * 0.4
            level = mic_level * 0.6 + wave
            h     = max(4, int(max_h * level))
            x     = start_x + i * (bar_w + gap)
            y     = base_y - h

            alpha = int(160 + 95 * abs(math.sin(tick * 0.08 + i * 0.3)))
            color = (40, 200, 255, alpha)

            s = pygame.Surface((bar_w, h), pygame.SRCALPHA)
            pygame.draw.rect(s, color, s.get_rect(), border_radius=bar_w // 2)
            self.screen.blit(s, (x, y))

    # ── SPEAKING INDICATOR ────────────────────────────────────────────────────

    def _draw_speaking_indicator(self, tick: int):
        """Animated speaker waves around the face when Monto is speaking."""
        cx  = self.face_cx
        cy  = self.face_cy
        r   = self.face_r

        # Draw 3 expanding arcs on the right side
        for i in range(1, 4):
            phase  = tick * 0.08 - i * 0.6
            alpha  = max(0, int(140 * abs(math.sin(phase))))
            offset = r + 15 + i * int(r * 0.18)
            arc_r  = offset

            s = pygame.Surface((arc_r * 2 + 4, arc_r * 2 + 4), pygame.SRCALPHA)
            start_a = -math.pi / 3
            end_a   =  math.pi / 3
            pygame.draw.arc(s, (255, 200, 60, alpha),
                            pygame.Rect(2, 2, arc_r*2, arc_r*2),
                            start_a, end_a, max(2, int(r * 0.025)))
            self.screen.blit(s, (cx - arc_r - 2, cy - arc_r - 2))

    # ── TEXT CARD ─────────────────────────────────────────────────────────────

    def _draw_text_card(self, text, emotion):
        acc    = Theme.accent(emotion)
        max_w  = int(self.W * 0.88)
        words  = text.split()
        lines, line = [], ""
        for w in words:
            test = (line + " " + w).strip()
            if self._f_text.size(test)[0] <= max_w:
                line = test
            else:
                if line: lines.append(line)
                line = w
        if line: lines.append(line)

        lh    = int(self.H * 0.042)
        pad   = int(self.H * 0.022)
        box_h = len(lines) * lh + pad * 2
        box_w = max_w + pad * 2
        box_y = self.H - box_h - int(self.H * 0.07)
        box_x = (self.W - box_w) // 2

        # Card background
        card = pygame.Surface((box_w, box_h), pygame.SRCALPHA)
        pygame.draw.rect(card, Theme.CARD_BG, card.get_rect(), border_radius=18)
        pygame.draw.rect(card, Theme.CARD_EDGE, card.get_rect(), width=1, border_radius=18)
        # Accent top edge
        top_edge = pygame.Surface((box_w - 40, 2), pygame.SRCALPHA)
        pygame.draw.line(top_edge, (*acc, 180), (0,0), (box_w-40, 0), 2)
        card.blit(top_edge, (20, 0))
        self.screen.blit(card, (box_x, box_y))

        y = box_y + pad
        for l in lines:
            surf = self._f_text.render(l, True, Theme.TEXT_FG)
            self.screen.blit(surf, ((self.W - surf.get_width()) // 2, y))
            y += lh

    # ── STATUS BAR ────────────────────────────────────────────────────────────

    def _draw_status_bar(self, emotion, mic_level: float = 0.0, talking: bool = False):
        acc   = Theme.accent(emotion)

        # Determine label
        if talking:
            icon, label = "🔊", "Monto is speaking..."
        elif emotion == "listening":
            icon, label = "🎤", "Listening — speak now!"
        elif emotion == "thinking":
            icon, label = "🤔", "Thinking..."
        elif emotion == "happy":
            icon, label = "😊", "Happy"
        elif emotion == "excited":
            icon, label = "🤩", "Excited"
        elif emotion == "sad":
            icon, label = "💛", "Comforting"
        elif emotion == "surprised":
            icon, label = "✨", "Surprised"
        else:
            icon, label = "●", "Press SPACE to talk to Monto"

        bar_h = int(self.H * 0.055)
        bar_y = self.H - bar_h
        bar   = pygame.Surface((self.W, bar_h), pygame.SRCALPHA)
        pygame.draw.rect(bar, (*Theme.BG_TOP, 200), bar.get_rect())
        pygame.draw.line(bar, (*acc, 100), (0, 0), (self.W, 0), 1)
        self.screen.blit(bar, (0, bar_y))

        # Mic level dots — inside status bar, left side
        if emotion == "listening":
            dot_count = 8
            for i in range(dot_count):
                filled = mic_level * dot_count >= i + 1
                col    = (*acc, 220) if filled else (*acc, 50)
                dx     = int(self.W * 0.06) + i * int(self.W * 0.025)
                dy     = bar_y + bar_h // 2
                pygame.gfxdraw.filled_circle(self.screen, dx, dy, 5, col)
                pygame.gfxdraw.aacircle(self.screen, dx, dy, 5, col)

        status = self._f_status.render(f"{icon}  {label}", True, (*acc,))
        self.screen.blit(status, ((self.W - status.get_width()) // 2,
                                   bar_y + (bar_h - status.get_height()) // 2))
