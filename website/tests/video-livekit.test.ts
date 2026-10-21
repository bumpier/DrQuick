import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { AccessToken, RoomServiceClient, ServerError } from 'livekit-server-sdk';
import { closeRoom, ensureRoom, mintPass, readWebhook, removeParticipant, videoConfig, type VideoConfig } from '@/lib/video/livekit';

// The one module that talks to the media server from our server: what a pass
// may do, how rooms are made and ended, and which webhooks are believed.

const SECRET = 'x'.repeat(43);
const CONFIG: VideoConfig = {
  url: 'wss://media.drquick.example', apiKey: 'APIkey123', apiSecret: SECRET, webhookKey: 'APIhook456', webhookSecret: 'w'.repeat(43),
};
const payloadOf = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

describe('the configuration', () => {
  beforeEach(() => {
    vi.stubEnv('LIVEKIT_URL', 'wss://media.drquick.example');
    vi.stubEnv('LIVEKIT_API_KEY', 'APIkey123');
    vi.stubEnv('LIVEKIT_API_SECRET', SECRET);
    vi.stubEnv('LIVEKIT_WEBHOOK_API_KEY', '');
    vi.stubEnv('LIVEKIT_WEBHOOK_API_SECRET', '');
    vi.stubEnv('LIVEKIT_CLOUD_TEST_ONLY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  test('needs a wss:// media server, a key and a long secret; webhooks use the same key unless given their own', () => {
    expect(videoConfig()).toEqual({ ...CONFIG, webhookKey: 'APIkey123', webhookSecret: SECRET });
    vi.stubEnv('LIVEKIT_WEBHOOK_API_KEY', 'APIhook456');
    vi.stubEnv('LIVEKIT_WEBHOOK_API_SECRET', 'w'.repeat(43));
    expect(videoConfig()).toEqual(CONFIG);
  });

  test('is off when anything is missing or weak', () => {
    for (const [name, value] of [
      ['LIVEKIT_URL', ''], ['LIVEKIT_URL', 'https://media.drquick.example'], ['LIVEKIT_URL', 'wss://media.drquick.example/x'],
      ['LIVEKIT_API_KEY', ''], ['LIVEKIT_API_SECRET', ''], ['LIVEKIT_API_SECRET', 'short'],
    ] as const) {
      vi.stubEnv(name, value);
      expect(videoConfig(), `${name}=${value}`).toBeNull();
      vi.unstubAllEnvs();
      vi.stubEnv('LIVEKIT_URL', 'wss://media.drquick.example');
      vi.stubEnv('LIVEKIT_API_KEY', 'APIkey123');
      vi.stubEnv('LIVEKIT_API_SECRET', SECRET);
    }
    vi.stubEnv('LIVEKIT_WEBHOOK_API_KEY', 'APIhook456');
    vi.stubEnv('LIVEKIT_WEBHOOK_API_SECRET', 'short');
    expect(videoConfig()).toBeNull();
  });

  // LiveKit Cloud is an independent controller of call telemetry, so a real
  // patient's call never runs there: a production server refuses it unless it
  // is explicitly a test deployment.
  test('a production server refuses LiveKit Cloud unless marked test-only', () => {
    vi.stubEnv('LIVEKIT_URL', 'wss://drquick-abc123.livekit.cloud');
    vi.stubEnv('NODE_ENV', 'production');
    expect(videoConfig()).toBeNull();
    vi.stubEnv('LIVEKIT_CLOUD_TEST_ONLY', '1');
    expect(videoConfig()?.url).toBe('wss://drquick-abc123.livekit.cloud');
    vi.stubEnv('LIVEKIT_CLOUD_TEST_ONLY', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(videoConfig()?.url).toBe('wss://drquick-abc123.livekit.cloud');
  });
});

describe('a pass', () => {
  // Exactly these rights and nothing more: one room, camera and microphone,
  // no data, no admin, no recording, no metadata, for two minutes.
  test('carries exactly the claims the call needs', async () => {
    const jwt = await mintPass(CONFIG, { room: 'ROOM_abc', identity: 'ID_gp' });
    const claims = payloadOf(jwt);
    expect(JSON.parse(Buffer.from(jwt.split('.')[0], 'base64url').toString('utf8')).alg).toBe('HS256');
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iss', 'nbf', 'sub', 'video']);
    expect(claims.iss).toBe('APIkey123');
    expect(claims.sub).toBe('ID_gp');
    expect(claims.exp - claims.nbf).toBe(120);
    expect(claims.video).toEqual({
      roomJoin: true, room: 'ROOM_abc', canPublish: true, canSubscribe: true, canPublishData: false,
      canPublishSources: ['camera', 'microphone'],
    });
  });
});

describe('rooms', () => {
  afterEach(() => vi.restoreAllMocks());

  // A room's limits only apply to a room the server created.
  test('are created by our server, for two people, closing soon after they leave', async () => {
    const create = vi.spyOn(RoomServiceClient.prototype, 'createRoom').mockResolvedValue({} as never);
    await ensureRoom(CONFIG, 'ROOM_abc');
    expect(create).toHaveBeenCalledWith({ name: 'ROOM_abc', maxParticipants: 2, emptyTimeout: 120, departureTimeout: 20 });
  });

  test('closing reports whether the room is gone, and never throws', async () => {
    const del = vi.spyOn(RoomServiceClient.prototype, 'deleteRoom');
    del.mockResolvedValueOnce(undefined);
    expect(await closeRoom(CONFIG, 'ROOM_abc')).toBe(true);
    del.mockRejectedValueOnce(new ServerError('not_found', 'room ROOM_abc not found', 404, 'not_found'));
    expect(await closeRoom(CONFIG, 'ROOM_abc')).toBe(true);
    del.mockRejectedValueOnce(new ServerError('internal', 'boom', 500, 'internal'));
    expect(await closeRoom(CONFIG, 'ROOM_abc')).toBe(false);
    del.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await closeRoom(CONFIG, 'ROOM_abc')).toBe(false);
  });

  test('a stranger can be removed, without throwing', async () => {
    const remove = vi.spyOn(RoomServiceClient.prototype, 'removeParticipant');
    remove.mockResolvedValueOnce(undefined);
    expect(await removeParticipant(CONFIG, 'ROOM_abc', 'ID_stranger')).toBe(true);
    expect(remove).toHaveBeenCalledWith('ROOM_abc', 'ID_stranger');
    remove.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await removeParticipant(CONFIG, 'ROOM_abc', 'ID_stranger')).toBe(false);
  });
});

describe('webhooks', () => {
  const NOW = new Date('2026-10-13T12:00:00Z');
  const seconds = (d: Date) => String(Math.floor(d.getTime() / 1000));
  const body = (over: Record<string, unknown> = {}) => JSON.stringify({
    event: 'participant_joined', id: 'EV_abc', createdAt: seconds(NOW),
    room: { name: 'ROOM_abc' }, participant: { identity: 'ID_gp' }, ...over,
  });
  // Signed as LiveKit signs them: a JWT from the webhook key whose sha256 claim is the body's hash.
  const sign = async (text: string, key = CONFIG.webhookKey, secret = CONFIG.webhookSecret) => {
    const token = new AccessToken(key, secret);
    token.sha256 = createHash('sha256').update(text).digest('base64');
    return token.toJwt();
  };

  test('a signed, fresh notice is read', async () => {
    const text = body();
    expect(await readWebhook(CONFIG, text, await sign(text), NOW)).toEqual({
      id: 'EV_abc', event: 'participant_joined', room: 'ROOM_abc', identity: 'ID_gp', unencryptedTrack: false,
    });
  });

  test('anything altered, unsigned or signed with another key is not believed', async () => {
    const text = body();
    const auth = await sign(text);
    expect(await readWebhook(CONFIG, text.replace('ID_gp', 'ID_xx'), auth, NOW)).toBeNull();
    expect(await readWebhook(CONFIG, text, null, NOW)).toBeNull();
    expect(await readWebhook(CONFIG, text, await sign(text, CONFIG.webhookKey, 'z'.repeat(43)), NOW)).toBeNull();
    expect(await readWebhook(CONFIG, text, 'not a token', NOW)).toBeNull();
  });

  // The signature is good for minutes, so an old notice could be replayed.
  test('a stale or future-dated notice is refused, and so is an oversized one', async () => {
    for (const createdAt of [new Date(NOW.getTime() - 301_000), new Date(NOW.getTime() + 61_000)]) {
      const text = body({ createdAt: seconds(createdAt) });
      expect(await readWebhook(CONFIG, text, await sign(text), NOW), createdAt.toISOString()).toBeNull();
    }
    const big = body({ participant: { identity: 'ID_gp', metadata: 'x'.repeat(70_000) } });
    expect(await readWebhook(CONFIG, big, await sign(big), NOW)).toBeNull();
  });

  test('a published track that is not end-to-end encrypted is flagged', async () => {
    const encrypted = body({ event: 'track_published', track: { sid: 'TR_1', encryption: 'GCM' } });
    expect((await readWebhook(CONFIG, encrypted, await sign(encrypted), NOW))?.unencryptedTrack).toBe(false);
    for (const track of [{ sid: 'TR_2' }, { sid: 'TR_3', encryption: 'NONE' }, { sid: 'TR_4', encryption: 'CUSTOM' }]) {
      const plain = body({ event: 'track_published', track });
      expect((await readWebhook(CONFIG, plain, await sign(plain), NOW))?.unencryptedTrack, JSON.stringify(track)).toBe(true);
    }
  });
});
