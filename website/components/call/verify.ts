// What the call screen may play, and when it may say "Encrypted end to end"
// (docs/superpowers/specs/2026-10-13-encrypted-video-calls-design.md).
//
// The browser decides this itself. LiveKit's receiver plays a track that the
// server says is unencrypted, so a compromised media server could show
// plaintext; and nothing in LiveKit says "this frame decrypted". So a track
// plays only if it is the other person's camera or microphone and marked
// encrypted, anything else fails the call, and the badge shows only while
// encryption is on both ways and the other person's media is actually decoding.

export type RemoteTrackInfo = { identity: string; source: string; encrypted: boolean };

export type EncryptionSnapshot = {
  now: number;
  e2eeEnabled: boolean;            // encryption on for what this browser sends
  localEncrypted: boolean;         // every local publication marked encrypted
  peerIdentity: string;
  remoteParticipants: string[];    // every identity in the room but ours
  remote: RemoteTrackInfo[];       // every remote publication
  lastVideoFrameAt: number | null; // the other person's video, last decoded frame
  peerCameraOff: boolean;
  lastAudioAt: number | null;      // the other person's audio, last decoded
  errorStreakStartedAt: number | null;
  lastErrorAt: number | null;      // the last decryption error
};

export type CallFailure = 'not_encrypted' | 'unexpected_participant' | 'encryption_failed';
export type Verdict = { failure: CallFailure | null; badge: 'verified' | 'checking' | 'none' };

const PLAYABLE = new Set(['camera', 'microphone']);
const FRESH_MS = 2_000;
const ERROR_GRACE_MS = 10_000;

/** A remote track may play only if it is the other person's camera or microphone, marked encrypted. */
export function mayPlay(track: RemoteTrackInfo, peerIdentity: string): boolean {
  return track.identity === peerIdentity && track.encrypted && PLAYABLE.has(track.source);
}

const recent = (at: number | null, now: number, within: number) => at !== null && now - at < within;

export function verifyEncryption(s: EncryptionSnapshot): Verdict {
  if (s.remoteParticipants.some((id) => id !== s.peerIdentity) || s.remote.some((t) => t.identity !== s.peerIdentity)) {
    return { failure: 'unexpected_participant', badge: 'none' };
  }
  if (s.remote.some((t) => !mayPlay(t, s.peerIdentity))) return { failure: 'not_encrypted', badge: 'none' };
  if (recent(s.lastErrorAt, s.now, FRESH_MS) && s.errorStreakStartedAt !== null && s.now - s.errorStreakStartedAt > ERROR_GRACE_MS) {
    return { failure: 'encryption_failed', badge: 'none' };
  }
  if (!s.e2eeEnabled || !s.localEncrypted || s.remote.length === 0) return { failure: null, badge: 'none' };
  if (recent(s.lastErrorAt, s.now, ERROR_GRACE_MS)) return { failure: null, badge: 'checking' };
  const decoding = recent(s.lastVideoFrameAt, s.now, FRESH_MS) || (s.peerCameraOff && recent(s.lastAudioAt, s.now, FRESH_MS));
  return { failure: null, badge: decoding ? 'verified' : 'checking' };
}
