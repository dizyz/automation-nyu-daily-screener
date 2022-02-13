export const NET_ID = process.env.NET_ID!;
export const NET_ID_PASSWORD = process.env.NET_ID_PASSWORD!;

export const HEADLESS = process.env.HEADLESS === 'true';

export const DUO_AUTH_MANUAL =
  process.env.DUO_AUTH_MANUAL &&
  process.env.DUO_AUTH_MANUAL.toLowerCase() === 'true';

export const DUO_SMS_PASSCODE_END_POINT =
  process.env.DUO_SMS_PASSCODE_END_POINT;
if (!DUO_AUTH_MANUAL && !DUO_SMS_PASSCODE_END_POINT) {
  throw new Error(
    'DUO_SMS_PASSCODE_END_POINT is not set under auto mode, please either set it or set DUO_AUTH_MANUAL to true',
  );
}

if (!NET_ID || !NET_ID_PASSWORD) {
  throw new Error('NET_ID and NET_ID_PASSWORD must be set in env vars');
}

export const TELEGRAM_SEND_API_ENDPOINT =
  process.env.TELEGRAM_SEND_API_ENDPOINT;
