import { BaseKeyProvider, createKeyMaterialFromBuffer } from 'livekit-client';

// The call's keys in the browser (docs/superpowers/specs/2026-10-13-encrypted-
// video-calls-design.md). Our server makes one 256-bit key per participant
// for each consultation; this browser encrypts with its own and decrypts the
// other person's, so a media server cannot swap or reflect streams between them.
//
// From reading LiveKit's code: its default key size is 128, so 256 is asked
// for; a key given as a string goes through a passphrase KDF, so keys go in as
// raw bytes (HKDF); and ratcheting is off, as LiveKit's own external provider
// has it. JavaScript cannot promise memory is wiped, so the strict CSP on these
// pages (lib/csp.ts) is the real protection; wipe() is the part we can do.

const KEY_BYTES = 32;
const B64URL_KEY = /^[A-Za-z0-9_-]{43}$/;

export class ParticipantKeyProvider extends BaseKeyProvider {
  constructor() {
    super({ sharedKey: false, keySize: 256, ratchetWindowSize: 0, failureTolerance: -1 });
  }

  /** One participant's key: 256 raw bits, for the identity it encrypts. */
  async setParticipantKey(identity: string, key: ArrayBuffer): Promise<void> {
    if (!identity || key.byteLength !== KEY_BYTES) throw new Error('a call key is 256 bits for one participant');
    this.onSetEncryptionKey(await createKeyMaterialFromBuffer(key), identity);
  }
}

/** A key from the pass (base64url) as raw bytes. The message never echoes the key. */
export function decodeKey(text: string): ArrayBuffer {
  if (!B64URL_KEY.test(text)) throw new Error('not a call key');
  const binary = atob(`${text.replace(/-/g, '+').replace(/_/g, '/')}=`);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  if (bytes.length !== KEY_BYTES) throw new Error('not a call key');
  return bytes.buffer;
}

export function wipe(buffer: ArrayBuffer): void {
  new Uint8Array(buffer).fill(0);
}

/** A fresh encryption worker for one call, terminated when it ends. Same origin: the CSP's worker-src 'self'. */
export function createE2EEWorker(): Worker {
  return new Worker(new URL('livekit-client/e2ee-worker', import.meta.url));
}
