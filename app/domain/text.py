"""Text normalisation for model-generated copy.

The brand never uses emoji (DESIGN_GUIDE 2: "No emoji. The brand never uses emoji.
State is shown with colored badges and Lucide icons, not emoji or unicode symbols").
A system-prompt instruction is only probabilistic, so replies are also stripped
deterministically before they are persisted or returned.
"""

import re

# Python's `re` has no \p{Extended_Pictographic} (that needs the third-party `regex`
# module), so the pictographic blocks are listed explicitly. Deliberately EXCLUDED,
# because the brand uses them and they are not emoji:
#   U+2190-21FF arrows  -- "→" is brand-sanctioned for drill-down (DESIGN_GUIDE 2)
#   U+2200-22FF maths   -- "≤ ≥ ±" appear in comparators like "Maturities ≤ 12 mo"
#   U+2000-206F punct.  -- em/en dashes and typographic quotes
#   U+2580-259F blocks  -- "▌" is the chat streaming cursor
_EMOJI_RANGES = (
    (0x1F000, 0x1FAFF),  # emoticons, transport, pictographs, flags, extended-A
    (0x1FB00, 0x1FBFF),  # symbols for legacy computing
    (0x2600, 0x26FF),    # miscellaneous symbols (sun, warning, star, recycle …)
    (0x2700, 0x27BF),    # dingbats (check mark button, sparkles, cross mark …)
    (0x2B00, 0x2BFF),    # miscellaneous symbols and arrows (⬆ ⭐ ⬛ …)
)

_EMOJI_CLASS = "".join(f"{chr(lo)}-{chr(hi)}" for lo, hi in _EMOJI_RANGES)

# Modifiers are written as escapes, never as literal characters — they are invisible in
# source and a literal combining mark inside a character class is genuinely ambiguous.
_VS16 = "\uFE0F"  # variation selector-16 (emoji presentation)
_ZWJ = "\u200D"  # zero-width joiner (family/profession sequences)
_KEYCAP = "\u20E3"  # combining enclosing keycap
_SKIN = "\U0001F3FB-\U0001F3FF"  # skin-tone modifiers

_EMOJI_RE = re.compile(
    "(?:"
    # keycap sequences: digit/#/* + optional VS16 + combining enclosing keycap
    f"[0-9#*]{_VS16}?{_KEYCAP}"
    "|"
    # a pictographic char plus any trailing VS16 / ZWJ-joined parts / skin tones
    f"[{_EMOJI_CLASS}](?:{_VS16}|{_ZWJ}[{_EMOJI_CLASS}]|[{_SKIN}])*"
    "|"
    # stray modifiers left behind on their own
    f"[{_VS16}{_ZWJ}{_KEYCAP}]"
    ")"
)

_INNER_GAP_RE = re.compile(r"[ \t]{2,}")


def strip_emoji(text: str) -> str:
    """Remove emoji from model output, leaving brand glyphs and markdown intact.

    Removing "### 📊 Overall" leaves a double space, so interior runs are collapsed —
    but only on lines that actually changed, and never the leading indentation, since
    that is what marks a nested list item or a code block.
    """
    if not text:
        return text

    changed = False
    lines = []
    for line in text.split("\n"):
        stripped = _EMOJI_RE.sub("", line)
        if stripped != line:
            changed = True
            # Keep the *original* indentation. Measuring it after the substitution would
            # mistake the space that followed a line-leading emoji for indentation.
            indent = line[: len(line) - len(line.lstrip(" \t"))]
            body = stripped[len(indent):] if stripped.startswith(indent) else stripped
            body = _INNER_GAP_RE.sub(" ", body.lstrip(" \t"))
            stripped = (indent + body).rstrip()
        lines.append(stripped)

    return "\n".join(lines) if changed else text
