#!/usr/bin/env python3
"""Download direct audio URLs or public Google Drive file share links."""

import argparse
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit


def download_audio(url: str, output: Path) -> None:
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("An HTTP(S) audio URL or public Google Drive file link is required.")
    output.parent.mkdir(parents=True, exist_ok=True)
    partial = output.with_name(output.name + ".part")
    try:
        if parsed.hostname.lower() in ("drive.google.com", "www.drive.google.com"):
            import gdown

            try:
                result = gdown.download(url=url, output=str(partial), fuzzy=True)
            except Exception as exc:
                raise ValueError(
                    "Google Drive download failed. Share the audio file with 'Anyone with "
                    "the link' and check that its download quota has not been exceeded."
                ) from exc
            if result is None:
                raise ValueError("Google Drive did not return a downloadable file. Check sharing permissions.")
        else:
            subprocess.run([
                "curl", "--fail", "--location", "--retry", "3",
                "--proto", "=http,https", "--proto-redir", "=http,https",
                "--connect-timeout", "30", "--max-time", "3600",
                "--output", str(partial), "--", url,
            ], check=True)
        if not partial.is_file() or partial.stat().st_size == 0:
            raise ValueError("Downloaded audio is empty.")
        with partial.open("rb") as stream:
            prefix = stream.read(4096).lstrip(b"\xef\xbb\xbf \t\r\n").lower()
        if prefix.startswith((b"<!doctype html", b"<html", b"<head", b"<body")):
            raise ValueError(
                "Downloaded a web page instead of audio. Use a direct audio URL or "
                "a Google Drive file shared with 'Anyone with the link'."
            )
        partial.replace(output)
    finally:
        partial.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    try:
        download_audio(args.url, args.output)
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        sys.exit(str(exc))


if __name__ == "__main__":
    main()
