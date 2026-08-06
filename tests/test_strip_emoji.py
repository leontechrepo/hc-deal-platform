"""
Tests for app/domain/text.py — Co-Pilot replies must contain no emoji
(DESIGN_GUIDE 2: "No emoji. The brand never uses emoji."), while leaving the glyphs
the brand *does* use, and the markdown structure, intact.

The markdown cases matter: an over-eager whitespace tidy-up ate the space after "###"
and "-", which silently stopped headings and bullets from parsing at all.
"""
import pytest

from app.domain.text import strip_emoji

# Glyphs the brand uses that must survive: the drill-down arrow and the comparators
# from DESIGN_GUIDE 2, typographic punctuation, and the chat streaming cursor.
BRAND_GLYPHS = ["→", "≤", "≥", "±", "·", "—", "–", "°", "▌", "‘", "’", "“", "”", "$", "~"]

EMOJI = [
    "📊", "🔵", "🏥", "💰", "✅", "❌", "⚠️", "🎯", "🚀", "✨", "☀", "⭐", "➡️",
    "🇺🇸",        # regional-indicator pair
    "1️⃣",        # keycap sequence
    "👍🏽",        # skin-tone modifier
    "👨‍👩‍👧",  # ZWJ family sequence
    "⌚", "⌛", "⏰", "⏱", "⏲", "⏳",  # Misc. Technical clock cluster (Codex review)
]

# Symbols the brand keeps intact that live outside the curated emoji blocks —
# regression coverage for the "does this range creep too wide" failure mode.
NON_EMOJI_TECHNICAL = ["™", "®", "©"]


@pytest.mark.parametrize("glyph", NON_EMOJI_TECHNICAL)
def test_non_emoji_technical_symbols_survive(glyph):
    assert glyph in strip_emoji(f"a{glyph}b")


@pytest.mark.parametrize("glyph", BRAND_GLYPHS)
def test_brand_glyphs_survive(glyph):
    assert glyph in strip_emoji(f"a{glyph}b")


@pytest.mark.parametrize("emoji", EMOJI)
def test_emoji_removed(emoji):
    assert strip_emoji(f"a{emoji}b") == "ab"


def test_empty_and_clean_text_pass_through():
    assert strip_emoji("") == ""
    clean = "Maturities ≤ 12 mo · View All Loans →"
    assert strip_emoji(clean) is clean  # unchanged input returned as-is


def test_markdown_structure_survives():
    src = (
        "### 📊 Overall\n"
        "- Total Active Deals: ~40\n"
        "  - 🔵 nested item\n"
        "- 💰 Portfolio: 3 positions | $33.1M | 0 on watch\n"
        "\n"
        "| Stage | # of Deals |\n"
        "|---|---|\n"
        "| Intake / Triage | ~28 |\n"
    )
    out = strip_emoji(src)

    assert out.startswith("### Overall"), "heading marker must keep its space"
    assert "\n- Total Active Deals: ~40" in out, "bullet marker must keep its space"
    assert "\n  - nested item" in out, "nested indentation must be preserved"
    assert "\n- Portfolio: 3 positions | $33.1M | 0 on watch" in out
    assert "| Intake / Triage | ~28 |" in out, "table rows untouched"
    assert not any(e in out for e in ("📊", "🔵", "💰"))


def test_untouched_lines_keep_their_spacing():
    """Only lines that actually changed get their interior runs collapsed."""
    src = "`code  with  spaces`\n💰 collapsed  here"
    out = strip_emoji(src).split("\n")
    assert out[0] == "`code  with  spaces`"
    assert out[1] == "collapsed here"
