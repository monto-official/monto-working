"""
Monto AI — Face Animation Demo
Test all emotions without mic or backend.
Press keys to change emotions:
  H = happy    S = sad      T = thinking
  E = excited  U = surprised L = listening
  I = idle     SPACE = talking toggle
  ESC = quit
"""
import sys
import time
import threading
from display.face import MontoFace

def demo_loop(face):
    emotions = [
        ("idle",      "Hello! I am Monto 😊",           3),
        ("happy",     "Wow, great to meet you! 🌟",     3),
        ("excited",   "This is so amazing! 🎉",         3),
        ("thinking",  "Hmm, let me think about that...", 3),
        ("surprised", "Oh wow, really?! 😲",            3),
        ("sad",       "Aww, that sounds hard 💛",       3),
        ("listening", "I'm listening...",               3),
        ("idle",      "",                               2),
    ]

    print("Face demo running!")
    print("Keys: H=happy S=sad T=thinking E=excited U=surprised L=listening I=idle SPACE=talk ESC=quit")

    while face.running:
        for emotion, text, duration in emotions:
            if not face.running:
                break
            print(f"  → {emotion}: {text}")
            face.set_emotion(emotion, text)
            time.sleep(duration)

        # Talking demo
        if face.running:
            face.set_emotion("happy", "Let me tell you something cool!")
            face.set_talking(True)
            time.sleep(3)
            face.set_talking(False)
            face.set_emotion("idle", "")
            time.sleep(2)

def key_control(face):
    """Optional keyboard control thread."""
    import pygame
    key_map = {
        pygame.K_h: ("happy",     "Wow, great! 😊"),
        pygame.K_s: ("sad",       "That sounds hard 💛"),
        pygame.K_t: ("thinking",  "Let me think... 🤔"),
        pygame.K_e: ("excited",   "Amazing! 🎉"),
        pygame.K_u: ("surprised", "Oh wow! 😲"),
        pygame.K_l: ("listening", "I'm listening..."),
        pygame.K_i: ("idle",      ""),
        pygame.K_n: ("neutral",   "Okay!"),
    }
    talking = [False]

    # Override pygame event handling
    original_run = face.run

    def patched_run():
        import pygame
        while face.running:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    face.running = False
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        face.running = False
                    elif event.key == pygame.K_SPACE:
                        talking[0] = not talking[0]
                        face.set_talking(talking[0])
                        print(f"  Talking: {talking[0]}")
                    elif event.key in key_map:
                        em, txt = key_map[event.key]
                        face.set_emotion(em, txt)
                        print(f"  → {em}")

            with face._lock:
                emotion = face.emotion
                text    = face.text
                tick    = face._tick
                trans_t = min(1.0, face._trans_t + 0.05)
                face._trans_t = trans_t
                talking_now = face.talking
                parts   = list(face.particles)

            face._draw_bg(emotion, tick)
            for p in parts:
                p.update()
                p.draw(face.screen)
            with face._lock:
                face.particles = [p for p in face.particles if p.life > 0]

            import pygame as pg
            acc = face.Theme.accent(emotion) if hasattr(face, 'Theme') else (100, 80, 220)
            face._draw_logo(emotion, tick)
            face._draw_face(emotion, tick, talking_now)
            if text:
                face._draw_text_card(text, emotion)
            face._draw_status_bar(emotion)

            pg.display.flip()
            face._tick += 1
            face.clock.tick(60)

        import pygame as pg
        pg.quit()

    face.run = patched_run

if __name__ == "__main__":
    print("Starting Monto Face Demo...")
    print("Close window or press ESC to quit")

    # Use smaller window if no fullscreen arg
    fullscreen = "--fullscreen" in sys.argv or "-f" in sys.argv

    face = MontoFace(
        width=800 if not fullscreen else 0,
        height=600 if not fullscreen else 0,
        fullscreen=fullscreen
    )

    # Start auto demo in background
    t = threading.Thread(target=demo_loop, args=(face,), daemon=True)
    t.start()

    # Run display on main thread
    face.run()
