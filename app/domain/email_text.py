"""Turn a Graph message into the text a model should actually read."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import unquote

try:
    from selectolax.lexbor import LexborHTMLParser
except ImportError:  # pragma: no cover
    LexborHTMLParser = None  # type: ignore[assignment]

DEFAULT_BUDGET_CHARS = 6000
_MIN_KEEP_CHARS = 40

_QUOTE_MARKERS: tuple[re.Pattern[str], ...] = (
    re.compile(r"^\s*-{2,}\s*Original Message\s*-{2,}\s*$", re.I | re.M),
    re.compile(r"^\s*From:\s.+\n\s*Sent:\s.+\n\s*To:\s", re.I | re.M),
    re.compile(r"^\s*On .{5,120}\s+wrote:\s*$", re.I | re.M),
    re.compile(r"^\s*_{10,}\s*$", re.M),
    re.compile(r"^\s*-{5,}\s*$", re.M),
    re.compile(r"^\s*>{1,}\s", re.M),
    re.compile(r"^\s*Sent from my (iPhone|iPad|Android|Samsung).*$", re.I | re.M),
)

_SIGNATURE_MARKERS = re.compile(
    r"^\s*(--\s*|__+\s*|Best regards,?|Kind regards,?|Regards,?|Warm regards,?|"
    r"Thanks,?|Thank you,?|Sincerely,?|Best,?|Cheers,?|All the best,?)\s*$",
    re.I | re.M,
)

_DISCLAIMER_MARKERS = re.compile(
    r"^\s*(CONFIDENTIALITY NOTICE|CONFIDENTIAL(?:ITY)?:|DISCLAIMER:|"
    r"This (?:e-?mail|message) and any files transmitted|"
    r"This (?:e-?mail|message) (?:is intended|may contain)|"
    r"The information contained in this (?:e-?mail|message)|"
    r"If you are not the intended recipient)",
    re.I | re.M,
)

_EXTERNAL_BANNER = re.compile(
    r"^\s*(?:\[?EXTERNAL(?:\s+EMAIL)?\]?\s*:?.*|"
    r"CAUTION\s*:\s*This (?:e-?mail|message) originated.*|"
    r"This (?:e-?mail|message) originated (?:from )?outside.*|"
    r"(?:Some people who received this message don't often get email from|"
    r"You don't often get email from).*)$",
    re.I | re.M,
)

_SAFELINK = re.compile(
    r"https?://[a-z0-9.-]*safelinks\.protection\.outlook\.com/\?url=([^&\s<>\]]+)"
    r"[^\s<>\]]*",
    re.I,
)
_CID_IMAGE = re.compile(r"\[cid:[^\]]*\]")
_DUPLICATED_LINK = re.compile(r"(\S+?)<(?:mailto:|https?://)[^>\s]*>")
_MULTI_NEWLINE = re.compile(r"\n{3,}")
_MULTI_SPACE = re.compile(r"[ \t]{2,}")
_ZERO_WIDTH = re.compile(r"[\u200b-\u200d\ufeff]")


@dataclass(frozen=True)
class PreparedEmail:
    text: str
    snippet: str
    was_truncated: bool
    source: str
    original_chars: int
    prepared_chars: int
    body_chars: int = 0


def html_to_text(html: str) -> str:
    if not html:
        return ""
    if LexborHTMLParser is None:  # pragma: no cover
        return re.sub(r"<[^>]+>", " ", html)
    tree = LexborHTMLParser(html)
    for tag in ("script", "style", "head"):
        for node in tree.css(tag):
            node.decompose()
    body = tree.body or tree.root
    return body.text(separator="\n") if body else ""


def _guarded(original: str, candidate: str) -> str:
    stripped = candidate.strip()
    return stripped if len(stripped) >= _MIN_KEEP_CHARS else original


def strip_mail_noise(text: str) -> str:
    if not text:
        return text
    text = _EXTERNAL_BANNER.sub("", text)
    text = _SAFELINK.sub(lambda m: unquote(m.group(1)), text)
    text = _CID_IMAGE.sub("", text)
    text = _DUPLICATED_LINK.sub(r"\1", text)
    return text


def strip_quoted_reply(text: str) -> str:
    if not text:
        return text
    earliest: int | None = None
    for pattern in _QUOTE_MARKERS:
        match = pattern.search(text)
        if match and (earliest is None or match.start() < earliest):
            earliest = match.start()
    return _guarded(text, text[:earliest]) if earliest is not None else text


def strip_signature(text: str) -> str:
    if not text:
        return text
    matches = list(_SIGNATURE_MARKERS.finditer(text))
    if not matches:
        return text
    return _guarded(text, text[: matches[-1].start()])


def strip_disclaimer(text: str) -> str:
    if not text:
        return text
    match = _DISCLAIMER_MARKERS.search(text)
    return _guarded(text, text[: match.start()]) if match else text


def collapse_whitespace(text: str) -> str:
    text = _ZERO_WIDTH.sub("", text.replace("\xa0", " ").replace("\r\n", "\n"))
    text = _MULTI_SPACE.sub(" ", text)
    text = _MULTI_NEWLINE.sub("\n\n", text)
    return "\n".join(line.rstrip() for line in text.split("\n")).strip()


def truncate(text: str, budget: int) -> tuple[str, bool]:
    if len(text) <= budget:
        return text, False
    head = int(budget * 0.75)
    tail = budget - head
    return f"{text[:head]}\n\n[... truncated ...]\n\n{text[-tail:]}", True


def _pick_source(msg: dict[str, Any]) -> tuple[str, str]:
    for key, label in (("uniqueBody", "uniqueBody"), ("body", "body")):
        block = msg.get(key) or {}
        content = (block.get("content") or "").strip()
        if content:
            kind = "html" if (block.get("contentType") or "").lower() == "html" else "text"
            return content, f"{label}_{kind}"
    preview = (msg.get("bodyPreview") or "").strip()
    if preview:
        return preview, "bodyPreview"
    return "", "empty"


def _format_address(entry: dict[str, Any] | None) -> str:
    address = ((entry or {}).get("emailAddress")) or {}
    name = (address.get("name") or "").strip()
    email = (address.get("address") or "").strip()
    if name and email and name.lower() != email.lower():
        return f"{name} <{email}>"
    return email or name


def sender_address(msg: dict[str, Any]) -> str | None:
    address = ((msg.get("from") or {}).get("emailAddress") or {}).get("address")
    return address.strip().lower() if address else None


def sender_name(msg: dict[str, Any]) -> str | None:
    name = ((msg.get("from") or {}).get("emailAddress") or {}).get("name")
    name = (name or "").strip()
    address = sender_address(msg)
    if not name or (address and name.lower() == address.lower()):
        return None
    return name


def email_domain(address: str | None) -> str | None:
    if not address or "@" not in address:
        return None
    return address.rsplit("@", 1)[-1].lower()


def prepare_email_text(
    msg: dict[str, Any], *, budget_chars: int = DEFAULT_BUDGET_CHARS
) -> PreparedEmail:
    raw, source = _pick_source(msg)
    original_chars = len(raw)

    body = html_to_text(raw) if source.endswith("_html") else raw
    body = strip_mail_noise(body)
    body = strip_quoted_reply(body)
    body = strip_disclaimer(body)
    body = strip_signature(body)
    body = collapse_whitespace(body)

    header_lines = [f"From: {_format_address(msg.get('from'))}"]
    recipients = [_format_address(r) for r in (msg.get("toRecipients") or [])[:4]]
    if recipients:
        header_lines.append(f"To: {', '.join(r for r in recipients if r)}")
    if msg.get("receivedDateTime"):
        header_lines.append(f"Date: {msg['receivedDateTime']}")
    header_lines.append(f"Subject: {msg.get('subject') or '(no subject)'}")
    if msg.get("hasAttachments"):
        header_lines.append("Attachments: yes")

    body, was_truncated = truncate(body, budget_chars)
    text = "\n".join(header_lines) + "\n\n" + body

    return PreparedEmail(
        text=text,
        snippet=body,
        was_truncated=was_truncated,
        source=source,
        original_chars=original_chars,
        prepared_chars=len(text),
        body_chars=len(body),
    )
