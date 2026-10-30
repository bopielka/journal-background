"""
Generates the 9-slice textures in texture/: a panel whose four corners are cut in by a concave
quarter circle, as a gold frame and as two fills (the hover gradient, and solid navy).

Run from the mod folder:  python tools/make-textures.py   (needs Pillow)

⚠️ SIZE, SLICE and the rem widths in ui/journal-background.js belong together: the CSS slices
the texture at SLICE px on every side. Change one, change the other.
"""
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 144          # final texture, px
SLICE = 48          # 9-slice inset, px - must equal border-image-slice in the CSS
NOTCH = 22          # radius of the concave corner cut, px
STROKE = 3          # frame line width, px
SS = 8              # supersampling factor for anti-aliasing

GOLD = (197, 165, 104)
GRADIENT_LEFT = (76, 71, 61, 255)    # #4c473d - the game's hover gradient
GRADIENT_RIGHT = (5, 7, 13, 128)     # rgba(5, 7, 13, 0.5)
NAVY = (16, 24, 48, 255)

OUT = Path(__file__).resolve().parent.parent / "texture"


def notched_mask(inset, notch):
    """White where the notched rectangle inset by `inset` px lies, at supersampled size."""
    s = SIZE * SS
    i = inset * SS
    r = notch * SS
    mask = Image.new("L", (s, s), 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle([i, i, s - 1 - i, s - 1 - i], fill=255)
    # The cut is centred on the OUTER corner, so every inset shape shares the same arc centres.
    for cx, cy in ((0, 0), (s - 1, 0), (0, s - 1), (s - 1, s - 1)):
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=0)
    return mask


def downsample(mask):
    return mask.resize((SIZE, SIZE), Image.LANCZOS)


def save(image, name):
    OUT.mkdir(exist_ok=True)
    image.save(OUT / name)
    print(f"wrote texture/{name}")


def main():
    outer = notched_mask(0, NOTCH)
    inner = notched_mask(STROKE, NOTCH + STROKE)

    # Frame: outer shape minus inner shape.
    ring = Image.new("L", outer.size, 0)
    ring.paste(outer, (0, 0))
    ring.paste(0, (0, 0), inner)
    frame = Image.new("RGBA", (SIZE, SIZE), GOLD + (0,))
    frame.putalpha(downsample(ring))
    save(frame, "journal-frame.png")

    # Fills sit under the frame line, never outside it.
    fill_alpha = downsample(notched_mask(1, NOTCH + 1))

    navy = Image.new("RGBA", (SIZE, SIZE), NAVY)
    navy.putalpha(fill_alpha.point(lambda a: a * NAVY[3] // 255))
    save(navy, "journal-fill-navy.png")

    gradient = Image.new("RGBA", (SIZE, SIZE))
    for x in range(SIZE):
        t = x / (SIZE - 1)
        colour = tuple(round(a + (b - a) * t) for a, b in zip(GRADIENT_LEFT, GRADIENT_RIGHT))
        for y in range(SIZE):
            gradient.putpixel((x, y), colour)
    shaped_alpha = Image.new("L", (SIZE, SIZE))
    for x in range(SIZE):
        for y in range(SIZE):
            shaped_alpha.putpixel((x, y), gradient.getpixel((x, y))[3] * fill_alpha.getpixel((x, y)) // 255)
    gradient.putalpha(shaped_alpha)
    save(gradient, "journal-fill-gradient.png")


if __name__ == "__main__":
    main()
