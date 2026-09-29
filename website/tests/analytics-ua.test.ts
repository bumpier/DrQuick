import { test, expect } from 'vitest';
import { isBot, parseUa } from '@/lib/analytics/ua';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.68',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0',
};

test.each([
  ['iphone', 'mobile', 'Safari', 'iOS'],
  ['ipad', 'tablet', 'Safari', 'iOS'],
  ['iosChrome', 'mobile', 'Chrome', 'iOS'],
  ['androidChrome', 'mobile', 'Chrome', 'Android'],
  ['androidTablet', 'tablet', 'Chrome', 'Android'],
  ['samsung', 'mobile', 'Samsung', 'Android'],
  ['macSafari', 'desktop', 'Safari', 'macOS'],
  ['macChrome', 'desktop', 'Chrome', 'macOS'],
  ['winEdge', 'desktop', 'Edge', 'Windows'],
  ['winFirefox', 'desktop', 'Firefox', 'Windows'],
  ['linuxFirefox', 'desktop', 'Firefox', 'Linux'],
  ['opera', 'desktop', 'Other', 'Windows'],
] as const)('%s → %s / %s / %s', (key, device, browser, os) => {
  expect(parseUa(UA[key])).toEqual({ device, browser, os });
});

test('an unknown or missing UA falls into the Other buckets on desktop', () => {
  expect(parseUa('')).toEqual({ device: 'desktop', browser: 'Other', os: 'Other' });
  expect(parseUa(null)).toEqual({ device: 'desktop', browser: 'Other', os: 'Other' });
});

test('bots, scripted clients and headless browsers are recognised; people are not', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/126.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse',
    'curl/8.6.0',
    'python-requests/2.32.3',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    '',
    '   ',
  ]) expect(isBot(ua), ua).toBe(true);
  expect(isBot(null)).toBe(true);
  for (const ua of Object.values(UA)) expect(isBot(ua), ua).toBe(false);
});
