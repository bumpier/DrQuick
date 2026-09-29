// A deliberately small user-agent reader for the analytics collector. It sorts
// a browser into three coarse buckets each for device, browser and OS — enough
// for a pre-launch dashboard, and too coarse to fingerprint anyone. The raw UA
// string is never stored.

export type Device = 'mobile' | 'tablet' | 'desktop';
export type Browser = 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Samsung' | 'Other';
export type Os = 'iOS' | 'Android' | 'macOS' | 'Windows' | 'Linux' | 'Other';

export type ParsedUa = { device: Device; browser: Browser; os: Os };

// Crawlers, link unfurlers, uptime checks, scripted clients and headless
// browsers. Anything matching is dropped before it reaches the database.
const BOT = new RegExp([
  'bot', 'crawl', 'spider', 'slurp', 'headless', 'lighthouse', 'preview', 'facebookexternalhit',
  'embedly', 'quora link', 'whatsapp', 'telegram', 'discord', 'slack', 'vkshare', 'pinterest',
  'curl', 'wget', 'python', 'axios', 'node-fetch', 'undici', 'go-http', 'java/', 'okhttp', 'httpclient',
  'libwww', 'phantom', 'puppeteer', 'playwright', 'selenium', 'cypress', 'pingdom', 'uptime',
  'monitor', 'gtmetrix', 'pagespeed', 'ahrefs', 'semrush', 'mj12', 'yandex', 'baidu', 'petal',
  'bytespider', 'gptbot', 'ccbot', 'perplexity', 'googleother', 'feedfetcher', 'validator',
].join('|'), 'i');

export function isBot(ua: string | null | undefined): boolean {
  const s = (ua ?? '').trim();
  return !s || BOT.test(s);
}

export function parseUa(ua: string | null | undefined): ParsedUa {
  const s = ua ?? '';

  let os: Os = 'Other';
  if (/iPhone|iPad|iPod/.test(s)) os = 'iOS';
  else if (/Android/.test(s)) os = 'Android';
  else if (/Windows/.test(s)) os = 'Windows';
  else if (/Macintosh|Mac OS X/.test(s)) os = 'macOS';
  else if (/Linux|X11/.test(s) && !/CrOS/.test(s)) os = 'Linux';

  // Order matters: Edge and Samsung Internet both carry "Chrome", Chrome
  // carries "Safari", and the iOS shells name themselves CriOS / FxiOS / EdgiOS.
  let browser: Browser = 'Other';
  if (/Edg(e|A|iOS)?\//.test(s)) browser = 'Edge';
  else if (/SamsungBrowser\//.test(s)) browser = 'Samsung';
  else if (/Firefox\/|FxiOS\//.test(s)) browser = 'Firefox';
  else if (/OPR\/|Opera|YaBrowser|Vivaldi/.test(s)) browser = 'Other';
  else if (/Chrome\/|CriOS\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';

  let device: Device = 'desktop';
  if (/iPad|Tablet|PlayBook|Silk|Kindle/.test(s) || (/Android/.test(s) && !/Mobile/.test(s))) device = 'tablet';
  else if (/Mobi|iPhone|iPod|Windows Phone|Android.*Mobile/.test(s)) device = 'mobile';

  return { device, browser, os };
}
