#!/usr/bin/env python3
import argparse
import subprocess
import sys
from pathlib import Path

import numpy as np
from faster_whisper import WhisperModel


def ts(t: float) -> str:
    h, r = divmod(int(round(t * 1000)), 3600000)
    m, r = divmod(r, 60000)
    s, ms = divmod(r, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def load_audio(path: Path) -> np.ndarray:
    """Decode any audio/video file to 16 kHz mono float32 via ffmpeg."""
    try:
        out = subprocess.run(
            ["ffmpeg", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", "16000",
             "-loglevel", "error", "pipe:1"],
            capture_output=True, check=True,
        ).stdout
    except FileNotFoundError:
        sys.exit("ffmpeg not found. Install it first (macOS: brew install ffmpeg).")
    except subprocess.CalledProcessError as e:
        sys.exit(f"ffmpeg failed:\n{e.stderr.decode(errors='ignore')}")
    return np.frombuffer(out, dtype=np.float32)


def resolve_model(model_arg: str | None, language: str | None) -> str:
    if model_arg is None:
        # KB-Whisper is Swedish-tuned; use standard Whisper for other languages
        return "KBLab/kb-whisper-medium" if language == "sv" else "medium"
    if model_arg in ("tiny", "base", "small", "medium", "large") and language == "sv":
        return f"KBLab/kb-whisper-{model_arg}"
    return model_arg  # e.g. "large-v3" or a full Hugging Face repo name


def resolve_output(output_arg: str | None, audio: Path) -> Path:
    default_name = audio.with_suffix(".srt").name
    if output_arg is None:
        return audio.parent / default_name
    out = Path(output_arg).expanduser()
    if out.suffix.lower() == ".srt":
        out.parent.mkdir(parents=True, exist_ok=True)
        return out
    out.mkdir(parents=True, exist_ok=True)  # treat as a directory
    return out / default_name


def main():
    p = argparse.ArgumentParser(
        description="Transcribe an audio file to an SRT subtitle file using faster-whisper.",
        epilog=(
            "examples:\n"
            "  python make_srt.py episode.mp3\n"
            "  python make_srt.py episode.mp3 -l sv -m small\n"
            "  python make_srt.py episode.mp3 -l en -o ~/subs\n"
            "  python make_srt.py episode.mp3 -o ~/subs/episode.sv.srt\n"
            "  python make_srt.py episode.mp3 -l auto"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("input", help="path to the audio (or video) file")
    p.add_argument("-l", "--language", default="sv",
                   help="language code, e.g. sv, en, de, or 'auto' to detect (default: sv)")
    p.add_argument("-o", "--output", default=None,
                   help="output directory or .srt file path "
                        "(default: same folder as the input file)")
    p.add_argument("-m", "--model", default=None,
                   help="model size (tiny/base/small/medium/large) or full model name. "
                        "Default: KB-Whisper medium for Swedish, Whisper medium otherwise")
    args = p.parse_args()

    audio_path = Path(args.input).expanduser()
    if not audio_path.is_file():
        sys.exit(f"File not found: {audio_path}")

    language = None if args.language.lower() == "auto" else args.language.lower()
    model_name = resolve_model(args.model, language)
    out_path = resolve_output(args.output, audio_path)

    print(f"Model:    {model_name}")
    print(f"Language: {language or 'auto-detect'}")
    print(f"Output:   {out_path}\n")

    print("Decoding audio...")
    audio = load_audio(audio_path)

    print("Loading model (first run downloads it)...")
    model = WhisperModel(model_name, device="auto", compute_type="auto")

    segments, info = model.transcribe(audio, language=language)
    if language is None:
        print(f"Detected language: {info.language}")

    with open(out_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            text = seg.text.strip()
            f.write(f"{i}\n{ts(seg.start)} --> {ts(seg.end)}\n{text}\n\n")
            print(f"[{ts(seg.end)}] {text}")

    print(f"\nSaved: {out_path}")


if __name__ == "__main__":
    main()