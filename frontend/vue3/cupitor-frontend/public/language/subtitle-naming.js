// Subtitle-file naming helpers, shared by the browser app (language.js) and the
// Node "Manage" CLI (tools/language). Pure — no DOM, no fs. The `channel || title
// || id` base-name convention is relied on by fetchCategorisation, local-file
// media-name parsing, and the srts/index.json tooling, so keep it stable.
import { nfc } from "./net.js";

// Strip filesystem/URL-reserved chars and the fullwidth colon U+FF1A (which slips
// in from SVT/YouTube metadata and is ugly when URL-encoded). Preserve ordinary
// spaces and Swedish letters — the " || " naming convention has spaces inside each
// piece, and they encode fine. Fullwidth quote/question marks (＂ ？) from source
// titles are intentionally left as-is.
export function sanitizeFilenameSegment(s, maxLen) {
  if (!s) return "";
  let out = String(s)
    .replace(/[\\/:*?"<>|：]/g, "_")
    .replace(/[\r\n\t\f\v]+/g, " ")
    .replace(/ +/g, " ")
    .replace(/_+/g, "_")
    .replace(/^[\s_]+|[\s_]+$/g, "");
  if (maxLen && out.length > maxLen) out = out.slice(0, maxLen).replace(/[\s_]+$/, "");
  return out;
}

// Build the `channel || title || id` base name for a captured subtitle. Each piece
// is sanitized and capped so the full filename stays well under FS / URL limits,
// then the whole thing is NFC-normalized.
export function buildCapturedSubtitleBaseName(detail) {
  const id = detail.videoId;
  const title = detail.videoTitle || id;
  const channel =
    detail.channel ||
    detail.channelTitle ||
    detail.videoChannel ||
    detail.uploader ||
    title;
  const safeChannel = sanitizeFilenameSegment(channel, 40);
  const safeTitle = sanitizeFilenameSegment(title, 60);
  return nfc([safeChannel, safeTitle, id].filter(Boolean).join(" || "));
}
