export const NET_ID = process.env.NET_ID!;
export const NET_ID_PASSWORD = process.env.NET_ID_PASSWORD!;

if (!NET_ID || !NET_ID_PASSWORD) {
  throw new Error('NET_ID and NET_ID_PASSWORD must be set in env vars');
}

export const TELEGRAM_SEND_API_ENDPOINT =
  process.env.TELEGRAM_SEND_API_ENDPOINT;
