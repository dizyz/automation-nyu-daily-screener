import {runDailyScreener} from './@nyu-daily-screener';
import {sendMessage} from './@telegram';

async function main(): Promise<void> {
  try {
    await runDailyScreener();
    await sendMessage({
      from: 'NYU Daily Screener',
      date: new Date().toLocaleString(),
      message: '---\nDaily Screener is successfully done',
    });
  } catch (error) {
    console.error(error);
    await sendMessage({
      from: 'NYU Daily Screener',
      date: new Date().toLocaleString(),
      message: '---\nDaily Screener failed.\n' + getMessageFromError(error),
    });
  }
}

main().catch(console.error);

function getMessageFromError(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }

  return JSON.stringify(error);
}
