import Axios from 'axios';

import {TELEGRAM_SEND_API_ENDPOINT} from './@env';

export interface SendMessageOptions {
  from?: string;
  date?: string;
  message: string;
}

export async function sendMessage(options: SendMessageOptions) {
  if (!TELEGRAM_SEND_API_ENDPOINT) {
    console.warn('TELEGRAM_SEND_API_ENDPOINT is not defined');
    return;
  }

  let {message} = options;
  let from = options.from || 'SmartLink';
  let date = options.date || new Date().toISOString();

  await Axios.post(TELEGRAM_SEND_API_ENDPOINT, {
    message: {
      body: message,
      number: from,
      received: date,
    },
  });
}
