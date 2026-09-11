#!/usr/bin/env python3
"""Convert Santa Barbara Corpus (.trn) transcripts into clean text or JSONL.

The SBC ships transcripts in a tab-separated format::

    0.00 6.52\tJAMIE:  \tHow [can you teach a three-year-old to] ta=p [2dance2].

carrying a dense layer of discourse-transcription notation. This tool peels that
notation off at a level you choose, and hands back either readable text or one
JSON object per utterance.

Run ``sbc_clean.py --help`` for the full flag list.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request
from dataclasses import dataclass, field

# --------------------------------------------------------------------------
# Feature table
# --------------------------------------------------------------------------
# Every piece of markup belongs to a "feature" that can be handled in one of
# four modes:
#
#   keep   leave the source notation untouched
#   drop   delete it (for span features this means unwrap: markup goes, words stay)
#   plain  replace with a human-readable stand-in, e.g. [laughs]
#   tag    replace with a machine-readable tag, e.g. <laugh/>

FEATURES = (
    "pauses",
    "lengthening",
    "overlaps",
    "laughter",
    "breaths",
    "noises",
    "events",
    "quality",
    "uncertain",
    "indecipherable",
    "glottal",
    "truncation",
    "pseudonyms",
)

# Span features wrap words. "drop" unwraps them rather than deleting the words.
SPAN_FEATURES = frozenset({"overlaps", "quality", "uncertain"})

LEVELS = {
    "readable": {
        "pauses": "drop",
        "lengthening": "drop",
        "overlaps": "plain",
        "laughter": "plain",
        "breaths": "drop",
        "noises": "plain",
        "events": "plain",
        "quality": "plain",
        "uncertain": "plain",
        "indecipherable": "plain",
        "glottal": "drop",
        "truncation": "drop",
        "pseudonyms": "drop",
    },
    "linguistic": {
        "pauses": "tag",
        "lengthening": "drop",
        "overlaps": "tag",
        "laughter": "tag",
        "breaths": "tag",
        "noises": "tag",
        "events": "tag",
        "quality": "tag",
        "uncertain": "tag",
        "indecipherable": "tag",
        "glottal": "drop",
        "truncation": "keep",
        "pseudonyms": "keep",
    },
    "minimal": {
        "pauses": "keep",
        "lengthening": "keep",
        "overlaps": "plain",
        "laughter": "keep",
        "breaths": "keep",
        "noises": "keep",
        "events": "keep",
        "quality": "keep",
        "uncertain": "keep",
        "indecipherable": "keep",
        "glottal": "keep",
        "truncation": "keep",
        "pseudonyms": "keep",
    },
}


def build_modes(level: str, keep: str | None = None, drop: str | None = None) -> dict:
    """Start from a level preset, then apply --keep / --drop overrides."""
    if level not in LEVELS:
        raise ValueError(f"unknown level {level!r}; choose from {', '.join(LEVELS)}")
    modes = dict(LEVELS[level])
    for names, mode in ((keep, "keep"), (drop, "drop")):
        for name in _split_list(names):
            if name not in FEATURES:
                raise ValueError(
                    f"unknown feature {name!r}; choose from {', '.join(FEATURES)}"
                )
            modes[name] = mode
    return modes


def _split_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in re.split(r"[,\s]+", value) if part.strip()]


FORMATS = ("md", "txt", "jsonl")


def parse_formats(value: str) -> tuple[str, ...]:
    """Accept one format, a comma-separated list of them, or "all"."""
    if value.strip() == "all":
        return FORMATS
    chosen: list[str] = []
    for name in _split_list(value):
        if name not in FORMATS:
            raise ValueError(
                f"unknown format {name!r}; choose from {', '.join(FORMATS)}, or 'all'"
            )
        if name not in chosen:
            chosen.append(name)
    if not chosen:
        raise ValueError("no output format given")
    return tuple(chosen)


# --------------------------------------------------------------------------
# Parsing
# --------------------------------------------------------------------------

TIMES_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$")
LINE_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(.*)$")
SPEAKER_RE = re.compile(r"^\s*(>?[A-Z][A-Z0-9_]*)\s*:\s*(.*)$")
EVENT_ONLY_RE = re.compile(r"^\s*\(\(.*\)\)\s*$")


@dataclass
class Utterance:
    start: float | None
    end: float | None
    speaker: str
    text: str
    kind: str = "speech"  # "speech" | "event"
    truncated: bool = False  # did this turn's LAST unit break off?
    truncations: int = 0  # how many of its units broke off
    units: int = 1
    raw: list[str] = field(default_factory=list)


def parse_line(line: str):
    """Return ``(start, end, speaker_or_None, text)`` or None for a blank line."""
    line = line.rstrip("\r\n")
    if not line.strip():
        return None

    parts = line.split("\t")
    if len(parts) >= 3:
        times = TIMES_RE.match(parts[0])
        if times:
            speaker = parts[1].strip().rstrip(":").strip()
            return (
                float(times.group(1)),
                float(times.group(2)),
                speaker or None,
                "\t".join(parts[2:]),
            )

    # Fall back to whitespace-delimited layout, used by some SBC releases.
    match = LINE_RE.match(line)
    if match:
        start, end, rest = match.groups()
        speaker_match = SPEAKER_RE.match(rest)
        if speaker_match:
            return float(start), float(end), speaker_match.group(1), speaker_match.group(2)
        return float(start), float(end), None, rest

    speaker_match = SPEAKER_RE.match(line)
    if speaker_match:
        return None, None, speaker_match.group(1), speaker_match.group(2)
    return None, None, None, line


def build_utterances(parsed) -> list[Utterance]:
    """Forward-fill blank speakers; route ``((...))``-only lines to ENV.

    A blank speaker column means "same speaker continues". Lines whose entire
    content is a ``((...))`` event are *not* attributed to the previous speaker
    even when their speaker column is blank -- ``((J,_M,_P_LAUGHING))`` belongs
    to the room, not to whoever spoke last.
    """
    utterances: list[Utterance] = []
    last_speaker: str | None = None

    for start, end, speaker, text in parsed:
        stripped = text.strip()
        is_event = EVENT_ONLY_RE.match(stripped) is not None

        if speaker:
            # A ">" prefix marks a non-participant sound source -- ">ENV",
            # ">RADIO", ">MAC", ">DOG". It is never a speaker, so it must not
            # become the one that later blank columns inherit.
            is_source = speaker.startswith(">")
            speaker = speaker.lstrip(">").strip()
            if is_source:
                is_event = True
            else:
                last_speaker = speaker
        elif is_event:
            speaker = None  # an unattributed event belongs to the room
        else:
            speaker = last_speaker

        if is_event:
            # An event the transcript does attribute keeps its speaker.
            utterances.append(
                Utterance(start, end, speaker or "ENV", stripped, kind="event", raw=[text])
            )
        else:
            utterances.append(
                Utterance(start, end, speaker or "UNKNOWN", stripped, raw=[text])
            )
    return utterances


# --------------------------------------------------------------------------
# & continuations
# --------------------------------------------------------------------------

AMP_END = re.compile(r"\s*&\s*$")
AMP_START = re.compile(r"^\s*&\s*")


def rejoin_continuations(utterances: list[Utterance]) -> list[Utterance]:
    """Stitch ``&``-split utterances back together.

    SBC marks a single intonation unit interrupted by another speaker with a
    trailing ``&`` and a leading ``&`` on its continuation. The halves belong to
    the same speaker but are separated by the interrupter's line.
    """
    result: list[Utterance] = []
    pending: dict[str, int] = {}

    for utterance in utterances:
        is_speech = utterance.kind == "speech"
        if is_speech and AMP_START.search(utterance.text) and utterance.speaker in pending:
            index = pending.pop(utterance.speaker)
            head = result[index]
            tail_text = AMP_START.sub("", utterance.text)
            head.text = (AMP_END.sub("", head.text) + " " + tail_text).strip()
            head.raw.extend(utterance.raw)
            if utterance.end is not None:
                head.end = utterance.end
            if AMP_END.search(utterance.text):
                pending[utterance.speaker] = index
            continue

        result.append(utterance)
        if is_speech:
            # Any earlier "&" this speaker left open was never continued.
            pending.pop(utterance.speaker, None)
            if AMP_END.search(utterance.text):
                pending[utterance.speaker] = len(result) - 1

    return result


# --------------------------------------------------------------------------
# Cleaning
# --------------------------------------------------------------------------

# Placeholder angle brackets, used while nested spans are being resolved.
LT, GT = "\x01", "\x02"

# Labels may carry a digit -- <L2 ... L2> marks a switch into another language.
SPAN_RE = re.compile(r"<([A-Z][A-Z0-9]*|[@%])([^<>]*)\1>")
# A span or overlap may open on one line and close on a later one, leaving a
# lone delimiter behind once the paired forms have been consumed.
ORPHAN_SPAN_OPEN_RE = re.compile(r"<([A-Z][A-Z0-9]*|[@%])(?!\S)")
ORPHAN_SPAN_CLOSE_RE = re.compile(r"(?<!\S)([A-Z][A-Z0-9]*|[@%])>")
NUMBERED_OVERLAP_RE = re.compile(r"\[(\d)([^\[\]]*)\1\]")
PLAIN_OVERLAP_RE = re.compile(r"\[([^\[\]]*)\]")
ORPHAN_OVERLAP_OPEN_RE = re.compile(r"\[\d")
ORPHAN_OVERLAP_CLOSE_RE = re.compile(r"(?<!\d)\d\]")
EVENT_RE = re.compile(r"\(\((.*?)\)\)")
NOISE_RE = re.compile(r"\(([A-Z][A-Za-z_]*)\)")
# SBC002 line 466 is "(TSK (H)3]" -- the closing paren is simply missing.
# All-caps only, so an ordinary parenthetical like "(Some words)" is untouched.
ORPHAN_NOISE_OPEN_RE = re.compile(r"\(([A-Z][A-Za-z_]*)(?![\w_])")
ORPHAN_NOISE_CLOSE_RE = re.compile(r"(?<![\w_])([A-Z][A-Za-z_]*)\)")

# Placeholder for a kept ((event)) while the rest of the line is processed.
STASH = "\x03"
LAUGH_RUN_RE = re.compile(r"(?<![A-Za-z<])@+(?![A-Za-z>])")
LAUGH_PREFIX_RE = re.compile(r"(?<![A-Za-z<])@(?=[A-Za-z])")
INDECIPHERABLE_RE = re.compile(r"(?<![A-Za-z<])X+(?![A-Za-z>])")
# Anonymised names carry "~" for participants and "!" for people they mention.
PSEUDONYM_RE = re.compile(r"[~!](?=[A-Za-z])")
GLOTTAL_RE = re.compile(r"(?<!<)%(?!>)")
TRUNCATION_RE = re.compile(r"\s*--\s*")
# A run of two or more dots is always a pause, wherever it sits: the corpus
# writes a pause glued to the previous word ("I'd.. try") and never writes a
# sentence period immediately followed by one. A single "." is left alone.
PAUSE_RE = re.compile(r"\.{2,}")
EMPTY_PARENS_RE = re.compile(r"\(\s*\)")

BREATH_DIRECTIONS = {"H": "in", "HX": "out"}

# Voice-quality span labels. <X ... X> is handled separately as "uncertain".
# The corpus treats this set as open-ended, so anything absent here falls through
# as its own lowercased label rather than being guessed at.
QUALITY_NAMES = {
    "VOX": "vox",  # speaking in someone else's voice
    "Q": "quotation",
    "P": "piano",  # quieter
    "F": "forte",  # louder
    "HI": "high",  # raised pitch
    "WH": "whisper",
    "SM": "smiling",
    "PAR": "parenthetical",
    "MRC": "marcato",
    "L2": "codeswitch",
    "CRK": "creaky",
    "@": "laughing",
    "%": "creaky",
}


def _humanize(token: str) -> str:
    return re.sub(r"_+", " ", token).strip().lower()


def _slug(token: str) -> str:
    return re.sub(r"\s+", "_", _humanize(token))


def clean_text(text: str, modes: dict) -> str:
    """Apply the configured mode for each markup feature, in dependency order."""
    text = text.strip()

    # A kept ((event)) is set aside whole. Its inner parens would otherwise read
    # as a vocalism, turning ((MUSIC_STOPS)) into "([music stops])".
    stashed: list[str] = []
    if modes["events"] == "keep":

        def hide(match: re.Match) -> str:
            stashed.append(match.group(0))
            return f"{STASH}{len(stashed) - 1}{STASH}"

        text = EVENT_RE.sub(hide, text)

    # Lengthening is stripped first: "=" is never structural, and removing it
    # later would eat the "=" in generated tags such as <q type="hi">.
    if modes["lengthening"] == "drop":
        text = text.replace("=", "")

    text = _apply_spans(text, modes)
    text = _apply_overlaps(text, modes)
    text = _apply_events(text, modes["events"])
    text = _apply_noises(text, modes)
    text = _apply_laughter(text, modes["laughter"])
    text = _apply_indecipherable(text, modes["indecipherable"])

    if modes["pseudonyms"] == "drop":
        text = PSEUDONYM_RE.sub("", text)
    if modes["glottal"] == "drop":
        text = GLOTTAL_RE.sub("", text)
    if modes["truncation"] == "drop":
        text = TRUNCATION_RE.sub(" ", text)

    text = _apply_pauses(text, modes["pauses"])

    # Any & left over had no partner; it is notation, never content.
    text = AMP_END.sub("", AMP_START.sub("", text))

    text = re.sub(r"\s+", " ", text).strip()
    # Tighten a space before punctuation, but never before a kept ".." pause.
    # "!" is excluded: in this corpus it opens a name, it does not end a sentence.
    text = re.sub(r"\s+([,?]|\.(?!\.))", r"\1", text)

    for index, original in enumerate(stashed):
        text = text.replace(f"{STASH}{index}{STASH}", original)
    return text


def _apply_spans(text: str, modes: dict) -> str:
    """Unwrap or tag ``<HI ... HI>`` / ``<X ... X>``, innermost first.

    SPAN_RE deliberately refuses to match across ``<`` or ``>``, which is what
    makes it resolve the innermost span first. Emitted tags therefore use
    placeholder angle brackets, so an already-tagged inner span (``<P<% .. %>P>``
    on line 891 of SBC002) does not block its own parent from matching.
    """
    if modes["quality"] == "keep" and modes["uncertain"] == "keep":
        return text

    def replace(match: re.Match) -> str:
        tag, inner = match.group(1), match.group(2)
        feature = "uncertain" if tag == "X" else "quality"
        mode = modes[feature]
        if mode == "keep":
            return match.group(0)
        if mode == "tag":
            if feature == "uncertain":
                return f"{LT}unsure{GT}{inner.strip()}{LT}/unsure{GT}"
            name = QUALITY_NAMES.get(tag, tag.lower())
            return f'{LT}q type="{name}"{GT}{inner.strip()}{LT}/q{GT}'
        # Unwrap keeping the delimiting spaces: stripping them would glue the
        # neighbours together and hide an adjacent orphan delimiter.
        return inner

    for _ in range(20):
        replaced = SPAN_RE.sub(replace, text)
        if replaced == text:
            break
        text = replaced

    def drop_orphan(match: re.Match) -> str:
        feature = "uncertain" if match.group(1) == "X" else "quality"
        return match.group(0) if modes[feature] == "keep" else ""

    # Looped, because "<X<P Oh I think you] told me X>." (line 1138) only exposes
    # its orphan <X once the inner <P has gone.
    for _ in range(20):
        replaced = ORPHAN_SPAN_OPEN_RE.sub(drop_orphan, text)
        replaced = ORPHAN_SPAN_CLOSE_RE.sub(drop_orphan, replaced)
        if replaced == text:
            break
        text = replaced

    # Doubled delimiters ("<<SLAPPING ... SLAPPING>>") leave one bare bracket.
    if modes["quality"] != "keep":
        text = re.sub(r"<(?![A-Za-z@%/])", "", text)
        text = re.sub(r"(?<![A-Za-z@%/\"])>", "", text)

    return text.replace(LT, "<").replace(GT, ">")


def _apply_overlaps(text: str, modes: dict) -> str:
    mode = modes["overlaps"]
    if mode == "keep":
        return text

    def numbered(match: re.Match) -> str:
        index, inner = match.group(1), match.group(2)
        if mode == "tag":
            return f'<ovl n="{index}">{inner}</ovl>'
        return inner

    def plain(match: re.Match) -> str:
        inner = match.group(1)
        if mode == "tag":
            return f"<ovl>{inner}</ovl>"
        return inner

    for _ in range(20):
        replaced = NUMBERED_OVERLAP_RE.sub(numbered, text)
        replaced = PLAIN_OVERLAP_RE.sub(plain, replaced)
        if replaced == text:
            break
        text = replaced

    # Overlaps whose partner sits on another line leave a lone delimiter behind.
    # The index digit goes with it -- but "1992]" is a year, not overlap 2.
    text = ORPHAN_OVERLAP_OPEN_RE.sub("", text)
    text = ORPHAN_OVERLAP_CLOSE_RE.sub("", text)
    return text.replace("[", "").replace("]", "")


def _apply_events(text: str, mode: str) -> str:
    if mode == "keep":
        return text

    def replace(match: re.Match) -> str:
        body = match.group(1)
        if mode == "drop":
            return ""
        if mode == "tag":
            return f'<event type="{_slug(body)}"/>'
        return f"[{_humanize(body)}]"

    return EVENT_RE.sub(replace, text)


def _apply_noises(text: str, modes: dict) -> str:
    def replace(match: re.Match) -> str:
        token = match.group(1)
        is_breath = token.upper() in BREATH_DIRECTIONS
        mode = modes["breaths"] if is_breath else modes["noises"]
        if mode == "keep":
            return match.group(0)
        if mode == "drop":
            return ""
        if mode == "tag":
            if is_breath:
                return f'<breath dir="{BREATH_DIRECTIONS[token.upper()]}"/>'
            return f'<vocal type="{_slug(token)}"/>'
        if is_breath:
            return ""  # a breath has no useful plain-text rendering
        return f"[{_humanize(token)}]"

    text = NOISE_RE.sub(replace, text)
    # Repair a half-written vocalism only where the parens really are unbalanced,
    # so an ordinary aside such as "(NOT me)" is left alone.
    if text.count("(") != text.count(")"):
        text = ORPHAN_NOISE_OPEN_RE.sub(replace, text)
        text = ORPHAN_NOISE_CLOSE_RE.sub(replace, text)
    if modes["noises"] != "keep":
        text = EMPTY_PARENS_RE.sub("", text)  # "@()" in SBC006 line 563
    return text


def _apply_laughter(text: str, mode: str) -> str:
    if mode == "keep":
        return text
    if mode == "tag":
        # Each @ is one laugh pulse, so the run length is worth carrying.
        text = LAUGH_RUN_RE.sub(
            lambda m: f'{LT}laugh pulses="{len(m.group(0))}"/{GT}'
            if len(m.group(0)) > 1
            else f"{LT}laugh/{GT}",
            text,
        )
    elif mode == "plain":
        text = LAUGH_RUN_RE.sub("[laughs]", text)
    else:
        text = LAUGH_RUN_RE.sub("", text)

    # A leading @ means "said while laughing"; the word itself always stays.
    if mode == "tag":
        text = LAUGH_PREFIX_RE.sub(f"{LT}laughing/{GT}", text)
    else:
        text = LAUGH_PREFIX_RE.sub("", text)
    return text.replace(LT, "<").replace(GT, ">")


def _apply_indecipherable(text: str, mode: str) -> str:
    if mode == "keep":
        return text
    if mode == "tag":
        # X is one indecipherable syllable, XX two, and so on.
        return INDECIPHERABLE_RE.sub(
            lambda m: f'<unclear syllables="{len(m.group(0))}"/>'
            if len(m.group(0)) > 1
            else "<unclear/>",
            text,
        )
    if mode == "plain":
        return INDECIPHERABLE_RE.sub("[unclear]", text)
    return INDECIPHERABLE_RE.sub("", text)


def _apply_pauses(text: str, mode: str) -> str:
    if mode == "keep":
        return text
    if mode == "tag":
        # Padded, because a pause can be glued to the word before it.
        return PAUSE_RE.sub(
            lambda m: " <pp/> " if len(m.group(0)) > 2 else " <p/> ", text
        )
    return PAUSE_RE.sub(" ", text)


# --------------------------------------------------------------------------
# Pipeline
# --------------------------------------------------------------------------

TRUNCATED_RE = re.compile(r"(--|\w-)\s*$")
# Text worth keeping has something in it besides spacing and bare punctuation.
CONTENT_RE = re.compile(r"[^\s,.?!;:\-]")


def convert(
    lines,
    modes: dict,
    merge: bool = True,
    keep_speakers=None,
    drop_env: bool = False,
) -> list[Utterance]:
    """Parse, clean, filter, then merge.

    Filtering has to precede merging: a discarded unit sitting between two of a
    speaker's own units would otherwise split one turn into two.
    """
    parsed = [row for row in (parse_line(line) for line in lines) if row]
    utterances = rejoin_continuations(build_utterances(parsed))

    for utterance in utterances:
        utterance.truncated = bool(TRUNCATED_RE.search(utterance.text))
        utterance.truncations = int(utterance.truncated)
        utterance.text = clean_text(utterance.text, modes)

    utterances = [u for u in utterances if CONTENT_RE.search(u.text)]
    if drop_env:
        utterances = [u for u in utterances if u.kind != "event"]
    if keep_speakers:
        utterances = [u for u in utterances if u.speaker in keep_speakers]

    return merge_turns(utterances) if merge else utterances


def merge_turns(utterances: list[Utterance]) -> list[Utterance]:
    """Join a speaker's consecutive intonation units into one turn."""
    merged: list[Utterance] = []
    for utterance in utterances:
        previous = merged[-1] if merged else None
        same_turn = (
            previous is not None
            and previous.kind == "speech"
            and utterance.kind == "speech"
            and previous.speaker == utterance.speaker
        )
        if same_turn:
            if utterance.text:
                previous.text = (previous.text + " " + utterance.text).strip()
            if utterance.end is not None:
                previous.end = utterance.end
            previous.raw.extend(utterance.raw)
            previous.units += 1
            # "truncated" is about how the turn ENDS; the count keeps the rest.
            previous.truncated = utterance.truncated
            previous.truncations += utterance.truncations
        else:
            merged.append(utterance)
    return merged


# --------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------


def render_markdown(utterances, title: str = "", timestamps: bool = False) -> str:
    """A readable transcript document: bold speakers, one turn per paragraph.

    "<" is escaped so that the tags produced by --level linguistic stay visible
    instead of being swallowed as inline HTML.
    """
    blocks = []
    if title:
        blocks.append(f"# {title}")
    for u in utterances:
        text = u.text.replace("<", "&lt;")
        stamp = ""
        if timestamps and u.start is not None and u.end is not None:
            stamp = f"`[{u.start:.2f}-{u.end:.2f}]` "
        if u.kind == "event":
            body = f"*{text}*" if u.speaker == "ENV" else f"**{u.speaker}:** *{text}*"
            blocks.append(f"> {stamp}{body}")
        else:
            blocks.append(f"{stamp}**{u.speaker}:** {text}")
    return "\n\n".join(blocks) + ("\n" if blocks else "")


def render_text(utterances, timestamps: bool = False) -> str:
    out = []
    for u in utterances:
        prefix = ""
        if timestamps and u.start is not None and u.end is not None:
            prefix = f"[{u.start:.2f}-{u.end:.2f}] "
        out.append(f"{prefix}{u.speaker}: {u.text}")
    return "\n".join(out) + ("\n" if out else "")


def render_jsonl(utterances, include_raw: bool = False) -> str:
    out = []
    for u in utterances:
        record = {
            "start": round(u.start, 2) if u.start is not None else None,
            "end": round(u.end, 2) if u.end is not None else None,
            "speaker": u.speaker,
            "kind": u.kind,
            "text": u.text,
            "truncated": u.truncated,
            "truncations": u.truncations,
            "units": u.units,
        }
        if include_raw:
            record["raw"] = u.raw
        out.append(json.dumps(record, ensure_ascii=False))
    return "\n".join(out) + ("\n" if out else "")


# --------------------------------------------------------------------------
# Input handling
# --------------------------------------------------------------------------


# Stray control bytes appear in the corpus (SBC015 has a NUL where a letter
# should be). Removing them also keeps them from colliding with the sentinels
# this module uses internally.
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
# Some files are Windows-1252 and write apostrophes and quotes as curly glyphs.
TYPOGRAPHIC = {"‘": "'", "’": "'", "“": '"', "”": '"'}


def decode(data: bytes) -> str:
    """Decode a transcript and normalise its punctuation to ASCII.

    cp1252 is tried before latin-1: it is what the older files actually are, and
    latin-1 would silently turn their apostrophes into control characters.
    """
    for encoding in ("utf-8", "cp1252", "latin-1"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    for fancy, plain in TYPOGRAPHIC.items():
        text = text.replace(fancy, plain)
    return CONTROL_RE.sub("", text)


def read_source(source: str) -> list[str]:
    if source.startswith(("http://", "https://")):
        request = urllib.request.Request(
            source, headers={"User-Agent": "sbc_clean/1.0"}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
    else:
        with open(source, "rb") as handle:
            data = handle.read()
    return decode(data).splitlines()


def expand_sources(sources) -> list[str]:
    expanded = []
    for source in sources:
        if not source.startswith(("http://", "https://")) and os.path.isdir(source):
            found = sorted(
                os.path.join(source, name)
                for name in os.listdir(source)
                if name.lower().endswith(".trn")
            )
            if not found:
                raise SystemExit(f"no .trn files found in {source}")
            expanded.extend(found)
        else:
            expanded.append(source)
    return expanded


def stem_of(source: str) -> str:
    base = source.rstrip("/").split("/")[-1]
    return os.path.splitext(base)[0] or "transcript"


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

EPILOG = """\
features for --keep / --drop:
  pauses lengthening overlaps laughter breaths noises events quality
  uncertain indecipherable glottal truncation pseudonyms

For span features (overlaps, quality, uncertain) "drop" removes the markup and
keeps the words inside it.

examples:
  sbc_clean.py SBC002.trn
  sbc_clean.py https://.../SBC002.trn --format jsonl -o sbc002.jsonl
  sbc_clean.py SBC002.trn --level readable --keep pauses,laughter
  sbc_clean.py corpus/ --format md,jsonl -o out/
"""


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sbc_clean.py",
        description="Convert Santa Barbara Corpus .trn transcripts to clean text or JSONL.",
        epilog=EPILOG,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("sources", nargs="+", metavar="SOURCE",
                        help="a .trn file, a directory of them, or an http(s) URL")
    parser.add_argument("-o", "--output",
                        help="output file; a directory for multiple formats or sources")
    parser.add_argument("--level", choices=sorted(LEVELS), default="readable",
                        help="cleaning preset (default: readable)")
    parser.add_argument("--keep", help="features to leave as written, comma separated")
    parser.add_argument("--drop", help="features to remove, comma separated")
    parser.add_argument("--format", default="md", metavar="LIST",
                        help="md, txt, jsonl; a comma-separated list, or all (default: md)")
    parser.add_argument("--merge", action=argparse.BooleanOptionalAction, default=True,
                        help="merge a speaker's consecutive lines into one turn (default: on)")
    parser.add_argument("--speakers", help="keep only these speakers, comma separated")
    parser.add_argument("--no-env", action="store_true",
                        help="omit ((...)) events and sources like >ENV, >RADIO")
    parser.add_argument("--timestamps", action="store_true",
                        help="prefix text output with turn timings")
    parser.add_argument("--include-raw", action="store_true",
                        help="add each unit's untouched source text to JSONL records")
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    try:
        modes = build_modes(args.level, args.keep, args.drop)
    except ValueError as error:
        raise SystemExit(f"sbc_clean: {error}")

    try:
        formats = parse_formats(args.format)
    except ValueError as error:
        raise SystemExit(f"sbc_clean: {error}")

    sources = expand_sources(args.sources)
    to_directory = len(sources) > 1 or len(formats) > 1

    if to_directory and not args.output:
        raise SystemExit(
            "sbc_clean: -o is required when writing multiple files "
            "(more than one --format, or more than one source)"
        )
    if to_directory:
        if os.path.exists(args.output) and not os.path.isdir(args.output):
            raise SystemExit(
                f"sbc_clean: {args.output} is a file, but -o must name a directory "
                "when writing multiple files"
            )
        os.makedirs(args.output, exist_ok=True)
    elif args.output and os.path.isdir(args.output):
        raise SystemExit(
            f"sbc_clean: {args.output} is a directory, but -o must name a file here"
        )

    keep_speakers = set(_split_list(args.speakers)) or None
    used_stems: set[str] = set()

    for source in sources:
        utterances = convert(
            read_source(source),
            modes,
            merge=args.merge,
            keep_speakers=keep_speakers,
            drop_env=args.no_env,
        )
        if not utterances:
            print(f"sbc_clean: {source} yielded no utterances", file=sys.stderr)

        stem = stem_of(source)
        if to_directory:  # two sources can share a basename
            unique, attempt = stem, 2
            while unique in used_stems:
                unique, attempt = f"{stem}-{attempt}", attempt + 1
            used_stems.add(unique)
            stem = unique

        for fmt in formats:
            if fmt == "md":
                payload = render_markdown(
                    utterances, title=stem, timestamps=args.timestamps
                )
            elif fmt == "txt":
                payload = render_text(utterances, timestamps=args.timestamps)
            else:
                payload = render_jsonl(utterances, include_raw=args.include_raw)

            if not args.output:
                sys.stdout.write(payload)
            elif to_directory:
                path = os.path.join(args.output, f"{stem}.clean.{fmt}")
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write(payload)
                print(f"wrote {path} ({len(utterances)} utterances)", file=sys.stderr)
            else:
                with open(args.output, "w", encoding="utf-8") as handle:
                    handle.write(payload)
                print(f"wrote {args.output} ({len(utterances)} utterances)", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
