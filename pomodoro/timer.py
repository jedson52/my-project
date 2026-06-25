import time
import sys
import select
import tty
import termios
import os
import signal

WORK_MIN = 25
SHORT_BREAK_MIN = 5
LONG_BREAK_MIN = 15
SESSIONS_BEFORE_LONG = 4

COLORS = {
    "red":    "\033[91m",
    "green":  "\033[92m",
    "yellow": "\033[93m",
    "cyan":   "\033[96m",
    "bold":   "\033[1m",
    "reset":  "\033[0m",
    "clear":  "\033[2J\033[H",
}

def color(text, *keys):
    return "".join(COLORS[k] for k in keys) + text + COLORS["reset"]

def fmt_time(seconds):
    m, s = divmod(max(0, seconds), 60)
    return f"{m:02d}:{s:02d}"

def bar(remaining, total, width=30):
    filled = int((total - remaining) / total * width)
    filled = max(0, min(width, filled))
    b = "█" * filled + "░" * (width - filled)
    return f"[{b}]"

def beep():
    sys.stdout.write("\a")
    sys.stdout.flush()

def kbhit():
    dr, _, _ = select.select([sys.stdin], [], [], 0)
    return bool(dr)

def getch():
    return sys.stdin.read(1)

def run_session(label, minutes, session_color):
    total = minutes * 60
    remaining = total
    paused = False
    old_settings = termios.tcgetattr(sys.stdin)
    try:
        tty.setcbreak(sys.stdin.fileno())
        while remaining >= 0:
            if kbhit():
                ch = getch().lower()
                if ch == 'q':
                    print(color("\n\nQuitting. Good work today!", "yellow", "bold"))
                    sys.exit(0)
                elif ch == ' ':
                    paused = not paused
                elif ch == 's':
                    break

            if not paused:
                print(COLORS["clear"], end="")
                print()
                print(color(f"  {label}", session_color, "bold"))
                print()
                print(color(f"  {fmt_time(remaining)}", "bold"), "   ", bar(remaining, total))
                print()
                print(color("  [space] pause   [s] skip   [q] quit", "reset"))
                sys.stdout.flush()
                time.sleep(1)
                remaining -= 1
            else:
                print(COLORS["clear"], end="")
                print()
                print(color(f"  {label}  — PAUSED", session_color, "bold"))
                print()
                print(color(f"  {fmt_time(remaining)}", "bold"), "   ", bar(remaining, total))
                print()
                print(color("  [space] resume   [s] skip   [q] quit", "reset"))
                sys.stdout.flush()
                time.sleep(0.2)
    finally:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)

    beep()

def main():
    completed = 0
    print(COLORS["clear"], end="")
    print(color("\n  Pomodoro Timer", "cyan", "bold"))
    print(color(f"  {WORK_MIN}m work · {SHORT_BREAK_MIN}m break · {LONG_BREAK_MIN}m long break\n", "reset"))
    time.sleep(1.5)

    while True:
        completed += 1
        run_session(f"Work session #{completed}", WORK_MIN, "red")
        print(COLORS["clear"])
        print(color(f"\n  Session #{completed} complete!", "green", "bold"))
        beep()
        time.sleep(1)

        if completed % SESSIONS_BEFORE_LONG == 0:
            run_session("Long break", LONG_BREAK_MIN, "cyan")
        else:
            run_session("Short break", SHORT_BREAK_MIN, "green")

if __name__ == "__main__":
    signal.signal(signal.SIGINT, lambda *_: (print(color("\n\nBye!", "yellow")), sys.exit(0)))
    main()
