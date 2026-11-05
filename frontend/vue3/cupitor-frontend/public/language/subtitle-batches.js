// Small captured clips can share a transaction; large transcripts still
// obey the byte budget and remain indivisible search units.
export const SUBTITLE_BATCH_DOCUMENTS = 128
export const SUBTITLE_BATCH_BYTES = 2 * 1024 * 1024
