"""
Monto AI — High Quality Animated Face Display
Smooth gradients, glow effects, anti-aliased drawing via pygame + numpy.

Emotions handled:
  idle | happy | sad | thinking | excited | surprised | listening | neutral
"""
import pygame
import pygame.gfxdraw
import math
import threading
import numpy as np


# ── PALETTE ───────────────────────────────────────────────────────────────────
BG_TOP      = (10,  12,  35)
BG_BOT      = (25,  20,  60)
FACE_MAIN   = (255, 218,  90)
FACE_SHAD   = (210, 165,  40)
FACE_HIGH   = (255, 240, 160)
EYE_COL     = (25,  25,  55)
PUPIL       = (60,  80, 180)
EYE_SHINE   = (255, 255, 255)
MOUTH_COL   = (190,  55,  55)
MOUTH_IN    = (240, 100,  90)
BLUSH_COL   = (255, 130, 130, 90)
TEAR_COL    = (100, 180, 255)
THINK_COL   = (160, 160, 255)
STAR_COL    = (255, 240,  80)
WAVE_COL    = (80,  200, 255)
TEXT_BG     = (10,  12,  40, 180)
TEXT_FG     = (220, 220, 255)
LABEL_COL   = (80,  80, 140)
GLOW_HAPPY  = (255, 220,  80, 40)
GLOW_SAD    = (100, 140, 200, 30)
GLOW_EXCITE = (255, 180,  50, 50)
# ─────────────────────────────────────────────────────────────────────────────


def _aa_circle(surf, color, pos, radius, width=0):
    """Anti-aliased filled or outlined circle."""
    x, y = int(pos[0]), int(pos[1])
    r    = int(radius)
    if width == 0:
        pygame.gfxdraw.filled_circle(surf, x, y, r, color)
        pygame.gfxdraw.aacircle(surf, x, y, r, color)
    else:
        pygame.gfxdraw.aacircle(surf, x, y, r, color)


def _gradient_bg(surf, w, h, top, bot):
    """Draw a vertical gradient background."""
    for y in range(h):
        t   = y / h
        r   = int(top[0] + (bot[0] - top[0]) * t)
        g   = int(top[1] + (bot[1] - top[1]) * t)
        b   = int(top[2] + (bot[2] - top[2]) * t)
        pygame.draw.line(surf, (r, g, b), (0, y), (w, y))


def _glow(surf, color, pos, radius, steps=6):
    """Soft radial glow using layered transparent circles."""
    glow_surf = pygame.Surface((radius * 2 + 40, radius * 2 + 40),
                               pygame.SRCALPHA)
    cx = radius + 20
    cy = radius + 20
    for i in range(steps, 0, -1):
        alpha = int(color[3] * i / steps) if len(color) > 3 else 30
        r     = int(radius + (steps - i) * 8)
        c     = (*color[:3], alpha)
        pygame.gfxdraw.filled_circle(glow_surf, cx, cy, r, c)
    surf.blit(glow_surf, (pos[0] - cx, pos[1] - cy))


class MontoFace:
    def __init__(self, width=800, height=600, fullscreen=False):
        pygame.init()
        pygame.display.set_caption("Monto AI")

        flags = pygame.FULLSCREEN | pygame.HWSURFACE | pygame.DOUBLEBUF \
                if fullscreen else pygame.HWSURFACE | pygame.DOUBLEBUF
        self.screen = pygame.display.set_mode((width, height), flags)
        self.W  = width
        self.H  = height
        self.cx = width  // 2
        self.cy = height // 2 - 30

        # Pre-render gradient background
        self._bg = pygame.Surface((width, height))
        _gradient_bg(self._bg, width, height, BG_TOP, BG_BOT)

        self.emotion  = "idle"
        self.text     = ""
        self.running  = True
        self._lock    = threading.Lock()
        self._tick    = 0
        self.clock    = pygame.time.Clock()

        # Fonts
        pygame.font.init()
        self._font_text  = pygame.font.SysFont("dejavusans",  24, bold=False)
        self._font_label = pygame.font.SysFont("dejavusans",  18, bold=True)
        self._font_big   = pygame.font.SysFont("dejavusans",  32, bold=True)

        pygame.mouse.set_visible(False)

    # ── PUBLIC API ────────────────────────────────────────────────────────────

    def set_emotion(self, emotion: str, text: str = ""):
        with self._lock:
            self.emotion = emotion.lower().strip()
            self.text    = text
            self._tick   = 0

    def stop(self):
        self.running = False

    def run(self):
        """Main render loop — must run on main thread."""
        while self.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.running = False
                if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                    self.running = False

            with self._lock:
                emotion = self.emotion
                text    = self.text
                tick    = self._tick

            # Background
            self.screen.blit(self._bg, (0, 0))

            # Draw everything
            self._draw_face(emotion, tick)
            if text:
                self._draw_text_box(text)
            self._draw_label(emotion)

            pygame.display.flip()
            self._tick += 1
            self.clock.tick(60)

        pygame.quit()

    # ── FACE DISPATCHER ───────────────────────────────────────────────────────

    def _draw_face(self, emotion, tick):
        # Smooth floating
        float_y = math.sin(tick * 0.04) * 7
        # Breathing scale
        scale   = 1.0 + math.sin(tick * 0.03) * 0.015

        cy = int(self.cy + float_y)
        cx = self.cx
        r  = int(140 * scale)

        dispatch = {
            "happy":     self._face_happy,
            "sad":       self._face_sad,
            "thinking":  self._face_thinking,
            "excited":   self._face_excited,
            "surprised": self._face_surprised,
            "listening": self._face_listening,
            "neutral":   self._face_idle,
        }
        fn = dispatch.get(emotion, self._face_idle)
        fn(cx, cy, r, tick)

    # ── FACE STATES ───────────────────────────────────────────────────────────

    def _face_idle(self, cx, cy, r, tick):
        self._draw_head(cx, cy, r)
        blink = (tick % 100) < 6
        self._draw_eyes(cx, cy, r, style="normal", blink=blink)
        self._draw_mouth(cx, cy, r, style="slight")

    def _face_happy(self, cx, cy, r, tick):
        _glow(self.screen, GLOW_HAPPY, (cx, cy), r + 20)
        self._draw_head(cx, cy, r)
        self._draw_blush(cx, cy, r)
        self._draw_eyes(cx, cy, r, style="happy")
        self._draw_mouth(cx, cy, r, style="big_smile")

    def _face_sad(self, cx, cy, r, tick):
        _glow(self.screen, GLOW_SAD, (cx, cy), r + 10)
        # Slightly lower, desaturated
        self._draw_head(cx, cy + 8, r, color=(200, 200, 155))
        self._draw_eyes(cx, cy + 8, r, style="sad")
        self._draw_mouth(cx, cy + 8, r, style="frown")
        # Teardrop
        ty = cy + int(r * 0.25) + int(abs(math.sin(tick * 0.07)) * 22)
        tx = cx + int(r * 0.38)
        pygame.gfxdraw.filled_ellipse(self.screen, tx, ty, 7, 13, TEAR_COL)
        pygame.gfxdraw.aaellipse(self.screen, tx, ty, 7, 13, TEAR_COL)

    def _face_thinking(self, cx, cy, r, tick):
        self._draw_head(cx, cy, r)
        self._draw_eyes(cx, cy, r, style="thinking")
        self._draw_mouth(cx, cy, r, style="pressed")
        # Eyebrow raised on right
        brow_y = cy - int(r * 0.5)
        pygame.draw.line(self.screen, EYE_COL,
                         (cx + 20, brow_y - 12), (cx + 65, brow_y - 22), 5)
        # Thought bubbles
        for i, (ox, oy, br) in enumerate([(55, -r - 15, 10),
                                           (80, -r - 38, 16),
                                           (110, -r - 68, 22)]):
            alpha = int(140 + 100 * math.sin(tick * 0.08 + i))
            c     = (*THINK_COL, alpha)
            _aa_circle(self.screen, (*THINK_COL, 60), (cx + ox, cy + oy), br)
            _aa_circle(self.screen, THINK_COL, (cx + ox, cy + oy), br, width=2)

    def _face_excited(self, cx, cy, r, tick):
        bounce = math.sin(tick * 0.25) * 10
        ey     = int(cy + bounce)
        _glow(self.screen, GLOW_EXCITE, (cx, ey), r + 25)
        self._draw_head(cx, ey, r)
        self._draw_blush(cx, ey, r)
        self._draw_eyes(cx, ey, r, style="excited")
        self._draw_mouth(cx, ey, r, style="open_smile")
        # Sparkles
        for i, (sx, sy) in enumerate([(-r - 30, -r + 10),
                                       ( r + 30, -r + 10),
                                       (      0, -r - 40)]):
            angle = tick * 0.06 + i * 2.09
            size  = 10 + int(math.sin(angle) * 4)
            self._draw_star(cx + sx, ey + sy, size, STAR_COL)

    def _face_surprised(self, cx, cy, r, tick):
        # Slight jump on trigger
        jolt = max(0.0, 1.0 - tick * 0.05) * -15
        ey   = int(cy + jolt)
        self._draw_head(cx, ey, r)
        self._draw_eyes(cx, ey, r, style="surprised")
        # Eyebrows way up
        brow_y = ey - int(r * 0.5)
        for bx in [cx - int(r * 0.35), cx + int(r * 0.08)]:
            pygame.draw.arc(self.screen, EYE_COL,
                            (bx, brow_y - 18, 50, 28), 0, math.pi, 5)
        # O mouth
        mx, my = cx, ey + int(r * 0.45)
        pygame.gfxdraw.filled_ellipse(self.screen, mx, my, 28, 22, MOUTH_COL)
        pygame.gfxdraw.filled_ellipse(self.screen, mx, my, 18, 14, (*MOUTH_IN, 255))

    def _face_listening(self, cx, cy, r, tick):
        self._draw_head(cx, cy, r)
        self._draw_eyes(cx, cy, r, style="normal")
        # Pulsing open mouth
        pulse = int(math.sin(tick * 0.18) * 9)
        my    = cy + int(r * 0.42)
        pygame.gfxdraw.filled_ellipse(self.screen, cx, my, 22, 12 + pulse, MOUTH_COL)
        pygame.gfxdraw.aaellipse(self.screen, cx, my, 22, 12 + pulse, MOUTH_COL)
        # Sound rings
        for i in range(1, 5):
            ring_r  = r + 20 + i * 22 + pulse
            alpha   = max(0, 180 - i * 40)
            ring_s  = pygame.Surface((ring_r * 2 + 4, ring_r * 2 + 4), pygame.SRCALPHA)
            pygame.gfxdraw.aacircle(ring_s, ring_r + 2, ring_r + 2,
                                    ring_r, (*WAVE_COL, alpha))
            self.screen.blit(ring_s, (cx - ring_r - 2, cy - ring_r - 2))

    # ── HEAD ─────────────────────────────────────────────────────────────────

    def _draw_head(self, cx, cy, r, color=None):
        fc = color or FACE_MAIN
        # Shadow
        _aa_circle(self.screen, (*FACE_SHAD, 120), (cx + 6, cy + 8), r)
        # Main face
        _aa_circle(self.screen, fc, (cx, cy), r)
        # Highlight top-left
        _aa_circle(self.screen, FACE_HIGH,
                   (cx - int(r * 0.3), cy - int(r * 0.3)),
                   int(r * 0.35))
        # Soft inner shadow bottom
        s = pygame.Surface((r * 2, r), pygame.SRCALPHA)
        pygame.gfxdraw.filled_ellipse(s, r, r // 2, r - 10, r // 2,
                                      (*FACE_SHAD, 40))
        self.screen.blit(s, (cx - r, cy))

    # ── EYES ──────────────────────────────────────────────────────────────────

    def _draw_eyes(self, cx, cy, r, style="normal", blink=False):
        lx = cx - int(r * 0.33)
        rx = cx + int(r * 0.33)
        ey = cy - int(r * 0.15)
        er = int(r * 0.17)   # eye radius

        if blink:
            pygame.draw.line(self.screen, EYE_COL,
                             (lx - er, ey), (lx + er, ey), 5)
            pygame.draw.line(self.screen, EYE_COL,
                             (rx - er, ey), (rx + er, ey), 5)
            return

        if style == "happy":
            # Curved upward arcs (^^ eyes)
            for ex in [lx, rx]:
                rect = pygame.Rect(ex - er, ey - 4, er * 2, er * 2)
                pygame.draw.arc(self.screen, EYE_COL, rect,
                                math.pi, 2 * math.pi, 5)
            return

        if style == "sad":
            for ex in [lx, rx]:
                rect = pygame.Rect(ex - er, ey - er // 2, er * 2, er * 2)
                pygame.draw.arc(self.screen, EYE_COL, rect,
                                0, math.pi, 5)
            return

        if style == "thinking":
            # Left eye half closed
            pygame.draw.line(self.screen, EYE_COL,
                             (lx - er, ey + 4), (lx + er, ey + 4), 5)
            # Right eye normal with pupil
            self._full_eye(rx, ey, er)
            return

        if style == "excited":
            for ex in [lx, rx]:
                self._full_eye(ex, ey, int(er * 1.25))
            return

        if style == "surprised":
            for ex in [lx, rx]:
                self._full_eye(ex, ey, int(er * 1.4))
            return

        # Default normal
        for ex in [lx, rx]:
            self._full_eye(ex, ey, er)

    def _full_eye(self, ex, ey, er):
        _aa_circle(self.screen, EYE_COL, (ex, ey), er)
        _aa_circle(self.screen, PUPIL, (ex + 2, ey + 2), max(4, int(er * 0.5)))
        _aa_circle(self.screen, EYE_SHINE, (ex + int(er * 0.35), ey - int(er * 0.35)),
                   max(3, int(er * 0.28)))

    # ── MOUTH ─────────────────────────────────────────────────────────────────

    def _draw_mouth(self, cx, cy, r, style="slight"):
        my = cy + int(r * 0.45)
        mw = int(r * 0.55)
        mh = int(r * 0.22)

        if style == "big_smile":
            rect = pygame.Rect(cx - mw, my - mh, mw * 2, mh * 2)
            pygame.draw.arc(self.screen, MOUTH_COL, rect,
                            math.pi, 2 * math.pi, 5)
            # Teeth
            teeth = pygame.Rect(cx - mw + 8, my - 2, mw * 2 - 16, mh - 4)
            pygame.draw.rect(self.screen, (240, 240, 240), teeth, border_radius=6)
            return

        if style == "slight":
            rect = pygame.Rect(cx - int(mw * 0.6), my - int(mh * 0.5),
                               int(mw * 1.2), int(mh * 1.2))
            pygame.draw.arc(self.screen, MOUTH_COL, rect,
                            math.pi, 2 * math.pi, 4)
            return

        if style == "frown":
            rect = pygame.Rect(cx - int(mw * 0.7), my, int(mw * 1.4), int(mh * 1.2))
            pygame.draw.arc(self.screen, MOUTH_COL, rect,
                            0, math.pi, 5)
            return

        if style == "pressed":
            pygame.draw.line(self.screen, MOUTH_COL,
                             (cx - int(mw * 0.5), my + 8),
                             (cx + int(mw * 0.5), my + 8), 5)
            return

        if style == "open_smile":
            rect = pygame.Rect(cx - mw, my - mh, mw * 2, mh * 2)
            pygame.draw.arc(self.screen, MOUTH_COL, rect,
                            math.pi, 2 * math.pi, 5)
            inner = pygame.Rect(cx - mw + 10, my - 4, mw * 2 - 20, mh)
            pygame.gfxdraw.filled_ellipse(self.screen,
                                          cx, my + 4,
                                          mw - 10, mh // 2,
                                          MOUTH_IN)
            return

    # ── BLUSH ─────────────────────────────────────────────────────────────────

    def _draw_blush(self, cx, cy, r):
        for bx in [cx - int(r * 0.72), cx + int(r * 0.72)]:
            s = pygame.Surface((60, 30), pygame.SRCALPHA)
            pygame.gfxdraw.filled_ellipse(s, 30, 15, 28, 14, BLUSH_COL)
            self.screen.blit(s, (bx - 30, cy + int(r * 0.18)))

    # ── STAR ──────────────────────────────────────────────────────────────────

    def _draw_star(self, x, y, size, color):
        pts = []
        for i in range(10):
            a = math.pi / 5 * i - math.pi / 2
            ro = size if i % 2 == 0 else size // 2
            pts.append((int(x + ro * math.cos(a)), int(y + ro * math.sin(a))))
        if len(pts) >= 3:
            pygame.gfxdraw.filled_polygon(self.screen, pts, color)
            pygame.gfxdraw.aapolygon(self.screen, pts, color)

    # ── TEXT BOX ──────────────────────────────────────────────────────────────

    def _draw_text_box(self, text):
        max_w  = self.W - 80
        words  = text.split()
        lines  = []
        line   = ""
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

        lh      = 32
        pad     = 16
        box_h   = len(lines) * lh + pad * 2
        box_y   = self.H - box_h - 20
        box_w   = max_w + pad * 2

        # Semi-transparent rounded box
        box = pygame.Surface((box_w, box_h), pygame.SRCALPHA)
        pygame.draw.rect(box, TEXT_BG, box.get_rect(), border_radius=16)
        self.screen.blit(box, ((self.W - box_w) // 2, box_y))

        y = box_y + pad
        for l in lines:
            surf = self._font_text.render(l, True, TEXT_FG)
            self.screen.blit(surf, ((self.W - surf.get_width()) // 2, y))
            y += lh

    # ── LABEL ─────────────────────────────────────────────────────────────────

    def _draw_label(self, emotion):
        icons = {
            "happy":     "😊",
            "sad":       "😢",
            "thinking":  "🤔",
            "excited":   "🤩",
            "surprised": "😲",
            "listening": "👂",
            "neutral":   "😐",
            "idle":      "💤",
        }
        label = f"{icons.get(emotion, '')}  {emotion.upper()}"
        surf  = self._font_label.render(label, True, LABEL_COL)
        self.screen.blit(surf, (14, 14))
