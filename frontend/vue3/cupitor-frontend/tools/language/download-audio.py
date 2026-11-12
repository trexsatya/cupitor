#!/usr/bin/env python3
"""Download direct audio URLs or public Google Drive file share links."""

import argparse
from email.parser import Parser
from email.utils import collapse_rfc2231_value
import mimetypes
from pathlib import Path
import re
import subprocess
import sys
from tempfile import TemporaryDirectory
from urllib.parse import unquote, urlsplit


def direct_filenames(headers: bytes, effective_url: str):
    # curl records redirects as well as the final response in the header file.
    for block in reversed(headers.split(b"\r\n\r\n")):
        status, _, fields = block.partition(b"\r\n")
        if status.startswith(b"HTTP/"):
            try:
                decoded = fields.decode("utf-8")
            except UnicodeDecodeError:
                decoded = fields.decode("latin-1")
            message = Parser().parsestr(decoded, headersonly=True)
            params = message.get_params(header="Content-Disposition", failobj=[])
            filenames = [value for key, value in params if key == "filename"]
            # Prefer the encoded filename* parameter when both forms are present.
            for value in sorted(filenames, key=lambda value: not isinstance(value, tuple)):
                yield collapse_rfc2231_value(value)
            break

    url_name = unquote(urlsplit(effective_url).path.rsplit("/", 1)[-1])
    media_type, _ = mimetypes.guess_type(url_name)
    if media_type and media_type.startswith(("audio/", "video/")):
        yield url_name


def safe_filename(name: str, default_extension: str) -> str | None:
    name = re.split(r"[/\\]", name)[-1].strip(" .")
    if not name or name.partition("?")[0] in {"uc", "download"}:
        return None
    name = re.sub(r'[\x00-\x1f\x7f<>:"|?*]', "_", name)
    path = Path(name)
    if path.suffix.lower() in {"", ".srt"}:
        name += default_extension
    subtitle_name = Path(name).with_suffix(".srt").name
    if max(len(name.encode("utf-8")), len(subtitle_name.encode("utf-8"))) <= 255:
        return name
    return None


def download_audio(url: str, output: Path, *, use_source_filename: bool = False) -> Path:
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("An HTTP(S) audio URL or public Google Drive file link is required.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".download-", dir=output.parent) as temp_dir:
        staging = Path(temp_dir)
        partial = staging / "audio"
        filenames = ()
        if parsed.hostname.lower() in ("drive.google.com", "www.drive.google.com"):
            import gdown

            try:
                destination = str(staging) + "/" if use_source_filename else str(partial)
                result = gdown.download(url=url, output=destination, fuzzy=True)
            except Exception as exc:
                raise ValueError(
                    "Google Drive download failed. Share the audio file with 'Anyone with "
                    "the link' and check that its download quota has not been exceeded."
                ) from exc
            if result is None:
                raise ValueError("Google Drive did not return a downloadable file. Check sharing permissions.")
            partial = Path(result)
            if partial.parent != staging:
                raise ValueError("Google Drive returned an invalid download path.")
            filenames = (partial.name,)
        else:
            headers = staging / "headers"
            transfer = subprocess.run([
                "curl", "--globoff", "--fail", "--location", "--retry", "3",
                "--proto", "=http,https", "--proto-redir", "=http,https",
                "--connect-timeout", "30", "--max-time", "3600",
                "--dump-header", str(headers), "--write-out", "%{url_effective}",
                "--output", str(partial), "--", url,
            ], check=True, stdout=subprocess.PIPE, text=True)
            if use_source_filename:
                filenames = direct_filenames(headers.read_bytes(), transfer.stdout)
        if not partial.is_file() or partial.stat().st_size == 0:
            raise ValueError("Downloaded audio is empty.")
        with partial.open("rb") as stream:
            prefix = stream.read(4096).lstrip(b"\xef\xbb\xbf \t\r\n").lower()
        if prefix.startswith((b"<!doctype html", b"<html", b"<head", b"<body")):
            raise ValueError(
                "Downloaded a web page instead of audio. Use a direct audio URL or "
                "a Google Drive file shared with 'Anyone with the link'."
            )
        if use_source_filename:
            for candidate in filenames:
                name = safe_filename(candidate, output.suffix or ".mp3")
                if name:
                    output = output.with_name(name)
                    break
        partial.replace(output)
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url")
    parser.add_argument("output", type=Path, help="output file path or fallback path")
    parser.add_argument("--use-source-filename", action="store_true",
                        help="use the source filename when available and print the saved path")
    args = parser.parse_args()
    try:
        output = download_audio(args.url, args.output, use_source_filename=args.use_source_filename)
    except (ValueError, OSError, subprocess.CalledProcessError) as exc:
        sys.exit(str(exc))
    if args.use_source_filename:
        print(output)


if __name__ == "__main__":
    main()
