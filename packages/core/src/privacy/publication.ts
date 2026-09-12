import type { PrivacyConfig } from "../config/types.js";

/** Transcripts are published only on explicit request: `privacy.publish_transcripts: true`. */
export function transcriptsPublished(privacy?: PrivacyConfig): boolean {
  return privacy?.publish_transcripts === true;
}
