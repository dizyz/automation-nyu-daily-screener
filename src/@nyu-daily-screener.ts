import Puppeteer from 'puppeteer';
import {
  HEADLESS,
  NET_ID,
  NET_ID_PASSWORD,
  DUO_AUTH_MANUAL,
  DUO_SMS_PASSCODE_END_POINT,
} from './@env';
import Axios from 'axios';

const DAILY_SCREENER_URL = 'https://www.nyu.edu/nyureturns/dailyscreener';

export async function runDailyScreener(): Promise<void> {
  let browser = await Puppeteer.launch({headless: HEADLESS});

  try {
    let page = await browser.newPage();

    await page.goto(DAILY_SCREENER_URL);

    await page.waitForNetworkIdle();
    await page.waitForSelector('#NextButton');

    console.log('Found next button, clicking...');

    let nextButton = await page.$('#NextButton');
    if (!nextButton) {
      throw new Error('Next button not found');
    }
    await nextButton.click();

    console.log('Next button clicked. Waiting for network idle...');

    await page.waitForNetworkIdle();
    await page.waitForSelector('#QID2');

    console.log('Found QID2, moving on...');

    let questionDiv = await page.$('#QID2');
    if (!questionDiv) {
      throw new Error('Question div not found');
    }

    console.log('Finding Whether not having NYU NetID question...');

    let rightQuestion = await questionDiv.$eval(
      '.QuestionText.BorderColor',
      element => {
        return element.textContent.includes('Do you have a NYU NetID');
      },
    );

    if (!rightQuestion) {
      throw new Error('Wrong question');
    }

    console.log('Answering question...');

    let questionChoiceInput = await questionDiv.$('input.QR-QID2-1');

    if (!questionChoiceInput) {
      throw new Error('Question choice input not found');
    }

    await questionChoiceInput.click();

    await page.waitForTimeout(500);

    console.log('Clicking next button...');

    let nextButton2 = await page.$('#NextButton');
    if (!nextButton2) {
      throw new Error('Next button not found');
    }
    await nextButton2.click();

    console.log('Next button clicked. Waiting for network idle...');

    await page.waitForTimeout(2000);

    await page.screenshot({path: 'screenshot.png'});

    console.log('Filling in NYU NetID credentials...');

    await page.waitForSelector('input#username');
    let title = await page.title();

    if (!title.includes('NYU Login')) {
      throw new Error('Not on NYU login page');
    }

    let usernameInput = await page.$('input#username');
    if (!usernameInput) {
      throw new Error('Username input not found');
    }
    let passwordInput = await page.$('input#password');
    if (!passwordInput) {
      throw new Error('Password input not found');
    }

    await usernameInput.type(NET_ID);
    await passwordInput.type(NET_ID_PASSWORD);

    let loginButton = await page.$(
      'button[type=submit][name=_eventId_proceed]',
    );
    if (!loginButton) {
      throw new Error('Login button not found');
    }

    console.log('Clicking login button...');

    await loginButton.click();

    console.log('Login button clicked. Waiting for duo auth...');

    if (!DUO_AUTH_MANUAL) {
      console.log('Automatic DUO Auth mode.');

      console.log('Waiting for duo auth iframe...');

      let duoIframeHandle = await page.waitForSelector('iframe#duo_iframe');
      if (!duoIframeHandle) {
        throw new Error('Duo iframe handle not found');
      }

      let duoIframe = await duoIframeHandle.contentFrame();
      if (!duoIframe) {
        throw new Error('Duo iframe not found');
      }

      console.log(
        'Duo iframe found. Waiting for duo auth navigation finished...',
      );

      await duoIframe.waitForNavigation();

      await duoIframe.waitForFunction(
        `document.querySelector('.message-text') && document.querySelector('.message-text').textContent.includes('Pushed a login request')`,
      );

      console.log('Duo auth navigation finished. Cancelling prompt...');

      let cancelButton = await duoIframe.$('button.btn-cancel');
      if (!cancelButton) {
        throw new Error('Cancel button not found');
      }
      await cancelButton.click();

      await duoIframe.waitForTimeout(2000);

      console.log('Cancelled prompt. Choosing twilio device...');

      let deviceSelectOptions = await duoIframe.$$(
        'select[name=device] > option',
      );
      if (!deviceSelectOptions || deviceSelectOptions.length === 0) {
        throw new Error('Device select options not found');
      }

      let twilioOptionValue: string | undefined;

      for (let option of deviceSelectOptions) {
        let text = await option.evaluate(element => {
          return element.textContent;
        });
        let value = await option.evaluate(element => {
          return element.value;
        });
        if (text.includes('Twilio')) {
          twilioOptionValue = value;
        }
      }

      if (!twilioOptionValue) {
        throw new Error('Twilio option not found');
      }

      let deviceSelect = await duoIframe.$('select[name=device]');
      if (!deviceSelect) {
        throw new Error('Device select not found');
      }
      await deviceSelect.select(twilioOptionValue);

      await duoIframe.waitForTimeout(200);

      console.log(
        'Twilio device selected. Clicking on passcode method button...',
      );

      let fieldsetSelector = `fieldset[data-device-index="${twilioOptionValue}"]`;

      let passCodeButton = await duoIframe.waitForSelector(
        `${fieldsetSelector} button#passcode`,
      );
      if (!passCodeButton) {
        throw new Error('Pass code button not found');
      }

      await passCodeButton.click();

      let fieldset = await duoIframe.$(fieldsetSelector);
      if (!fieldset) {
        throw new Error('Fieldset not found');
      }

      console.log(
        'Passcode method chosen. Getting passcode starting digit hint...',
      );

      await duoIframe.waitForSelector('button#message');

      let nextPasscodeMsgDiv = await fieldset.$('.next-passcode-msg');
      if (!nextPasscodeMsgDiv) {
        throw new Error('Next passcode message div not found');
      }
      let nextPasscodeMsg = await nextPasscodeMsgDiv.evaluate(element => {
        return element.textContent;
      });

      console.log(
        'Passcode starting digit hint:',
        nextPasscodeMsg || '[empty]',
      );

      let passcode: string;

      if (!nextPasscodeMsg.includes('Your next SMS Passcode starts with')) {
        console.log('Next passcode message not found, sending SMS...');

        let messageButton = await duoIframe.$('button#message');
        if (!messageButton) {
          throw new Error('Message button not found');
        }
        await messageButton.click();

        console.log('SMS sent. Fetching SMS...');

        let messageSentTime = Date.now();
        let passcodeBundle = await waitForNewDuoPasscode(messageSentTime);
        if (!passcodeBundle) {
          throw new Error('New Duo passcode bundle not found');
        }
        passcode = passcodeBundle.code;
      } else {
        console.log('Next passcode message found, using last SMS...');

        let numMatch = /\d/.exec(nextPasscodeMsg);
        if (!numMatch) {
          throw new Error('Next passcode message found, but no number found');
        }
        let startDigit = numMatch[0];
        let passcodeBundle = await getDouPasscode(startDigit);
        if (!passcodeBundle) {
          throw new Error('Passcode bundle not received');
        }
        passcode = passcodeBundle.code;
      }

      console.log('Passcode:', passcode);
      console.log('Filling in passcode...');

      let passcodeInput = await fieldset.$('input[name=passcode]');
      if (!passcodeInput) {
        throw new Error('Passcode input not found');
      }
      await passcodeInput.type(passcode);

      console.log('Passcode filled in. Submitting passcode...');

      let passcodeSubmitButton = await fieldset.$('button#passcode');
      if (!passcodeSubmitButton) {
        throw new Error('Passcode submit button not found');
      }
      await passcodeSubmitButton.click();

      console.log('Passcode submitted. Waiting for passcode navigation...');
    } else {
      console.log('Manual DUO Auth mode. Waiting for manual auth response...');
    }

    await page.waitForFunction(
      `
      document.body && document.body.textContent.includes('Screener Status:')
    `,
      {timeout: 30000},
    );

    console.log('Screener finished successfully!');

    await page.waitForTimeout(1000);
    await page.screenshot({path: 'screenshot-final.png'});
  } finally {
    await browser.close();
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface DuoPasscodeBundle {
  code: string;
  updatedAt: number;
}

async function getDouPasscode(
  nextDigit: string = '1',
): Promise<DuoPasscodeBundle | undefined> {
  if (!DUO_SMS_PASSCODE_END_POINT) {
    throw new Error('Duo SMS Passcode endpoint not set');
  }
  let response = await Axios.get(
    `${DUO_SMS_PASSCODE_END_POINT}?next=${nextDigit}`,
  );
  let {error, code, updatedAt} = response.data;
  if (error) {
    console.error(error);
    return undefined;
  }
  return {
    code,
    updatedAt,
  };
}

async function waitForNewDuoPasscode(
  lastUpdatedAt: number,
  timeout: number = 40000,
): Promise<DuoPasscodeBundle | undefined> {
  let startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    let passcodeBundle = await getDouPasscode();
    if (passcodeBundle && passcodeBundle.updatedAt > lastUpdatedAt) {
      return passcodeBundle;
    }
    await sleep(2000);
  }
  return undefined;
}
