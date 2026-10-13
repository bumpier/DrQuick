import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver } from 'livekit-server-sdk';
import { livekitOrigin } from '@/lib/csp';

// The only module that talks to the media server (LiveKit) from our server:
// passes, rooms and webhooks (docs/superpowers/specs/2026-10-13-encrypted-video-
// calls-design.md). Its rules come from reading LiveKit's own code:
//
// - A pass's expiry only gates the first connection; the server renews it while
//   someone is connected. So a pass lives two minutes, and a call is ended by
//   deleting its room, never by waiting for passes to lapse.
// - A room's limits only apply to a room the server created, so our server
//   creates it before any pass is issued.
// - Publishing data is allowed unless denied, so it is denied.
// - A webhook's signature is good for minutes and carries no replay guard, so a
//   notice is believed only while fresh, and its id is recorded once (calls.ts).
//
// Nothing here throws an error carrying a token, a secret or a server's
// message: closing and removing report true or false, reading a webhook null.

export type VideoConfig = { url: string; apiKey: string; apiSecret: string; webhookKey: string; webhookSecret: string };

const PASS_SECONDS = 120;
const MIN_SECRET = 32;
const WEBHOOK_MAX_BYTES = 64 * 1024;
const WEBHOOK_MAX_AGE_SECONDS = 300;
const WEBHOOK_MAX_SKEW_SECONDS = 60;
// livekit.Encryption.Type.GCM: the frame encryption the browsers use.
const GCM = 1;

const env = (name: string) => process.env[name]?.trim() || '';

/**
 * The media server's settings, or null, which leaves video calls off. A real
 * patient's call never runs on LiveKit Cloud, which is an independent
 * controller of call telemetry: a production server refuses it unless
 * LIVEKIT_CLOUD_TEST_ONLY marks a deployment that sees no patients.
 */
export function videoConfig(): VideoConfig | null {
  const url = livekitOrigin(process.env.LIVEKIT_URL);
  const apiKey = env('LIVEKIT_API_KEY');
  const apiSecret = env('LIVEKIT_API_SECRET');
  if (!url || !apiKey || apiSecret.length < MIN_SECRET) return null;
  const cloud = new URL(url).hostname.endsWith('.livekit.cloud');
  if (cloud && process.env.NODE_ENV === 'production' && env('LIVEKIT_CLOUD_TEST_ONLY') !== '1') return null;
  const webhookKey = env('LIVEKIT_WEBHOOK_API_KEY') || apiKey;
  const webhookSecret = env('LIVEKIT_WEBHOOK_API_KEY') ? env('LIVEKIT_WEBHOOK_API_SECRET') : apiSecret;
  if (webhookSecret.length < MIN_SECRET) return null;
  return { url, apiKey, apiSecret, webhookKey, webhookSecret };
}

/** A pass to join one room as one identity for two minutes: camera and microphone, and nothing else. */
export async function mintPass(config: VideoConfig, { room, identity }: { room: string; identity: string }): Promise<string> {
  const token = new AccessToken(config.apiKey, config.apiSecret, { identity, ttl: PASS_SECONDS });
  token.addGrant({
    roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: false,
    canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
  });
  return token.toJwt();
}

const rooms = (config: VideoConfig) =>
  new RoomServiceClient(config.url.replace(/^wss:/, 'https:'), config.apiKey, config.apiSecret);

/** Creates the room, or finds it already made: two people at most, closing soon after they leave. Throws if the server cannot be reached. */
export async function ensureRoom(config: VideoConfig, room: string): Promise<void> {
  try {
    await rooms(config).createRoom({ name: room, maxParticipants: 2, emptyTimeout: 120, departureTimeout: 20 });
  } catch {
    throw new Error('media server unavailable');
  }
}

const notFound = (err: unknown) => (err as { status?: number; code?: string }).status === 404
  || (err as { code?: string }).code === 'not_found';

/** Deletes the room, which disconnects everyone in it. True once the room is gone, whether now or already. */
export async function closeRoom(config: VideoConfig, room: string): Promise<boolean> {
  try {
    await rooms(config).deleteRoom(room);
    return true;
  } catch (err) {
    return notFound(err);
  }
}

/** Removes one participant from a room. True if they are gone. */
export async function removeParticipant(config: VideoConfig, room: string, identity: string): Promise<boolean> {
  try {
    await rooms(config).removeParticipant(room, identity);
    return true;
  } catch (err) {
    return notFound(err);
  }
}

export type CallWebhook = { id: string; event: string; room: string | null; identity: string | null; unencryptedTrack: boolean };

/**
 * A webhook from the media server, if it is signed by the webhook key over this
 * exact body, small, and fresh. Null otherwise. The caller still records its id
 * once, so a replay within the window changes nothing.
 */
export async function readWebhook(
  config: VideoConfig, body: string, authorization: string | null, now = new Date(),
): Promise<CallWebhook | null> {
  if (!authorization || Buffer.byteLength(body, 'utf8') > WEBHOOK_MAX_BYTES) return null;
  let event;
  try {
    event = await new WebhookReceiver(config.webhookKey, config.webhookSecret).receive(body, authorization);
  } catch {
    return null;
  }
  const createdAt = Number(event.createdAt);
  const age = now.getTime() / 1000 - createdAt;
  if (!event.id || !Number.isFinite(createdAt) || age > WEBHOOK_MAX_AGE_SECONDS || age < -WEBHOOK_MAX_SKEW_SECONDS) return null;
  return {
    id: event.id,
    event: event.event,
    room: event.room?.name || null,
    identity: event.participant?.identity || null,
    unencryptedTrack: event.event === 'track_published' && event.track?.encryption !== GCM,
  };
}
