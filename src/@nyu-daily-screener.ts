import Puppeteer from 'puppeteer';
import {NET_ID, NET_ID_PASSWORD} from './@env';

const DAILY_SCREENER_URL = 'https://www.nyu.edu/nyureturns/dailyscreener';

export async function runDailyScreener(): Promise<void> {
  let browser = await Puppeteer.launch({headless: true});

  try {
    let page = await browser.newPage();

    await page.goto(DAILY_SCREENER_URL);

    await page.waitForNetworkIdle();
    await page.waitForSelector('#NextButton');

    let nextButton = await page.$('#NextButton');
    if (!nextButton) {
      throw new Error('Next button not found');
    }
    await nextButton.click();

    await page.waitForNetworkIdle();
    await page.waitForSelector('#QID2');

    let questionDiv = await page.$('#QID2');
    if (!questionDiv) {
      throw new Error('Question div not found');
    }

    let rightQuestion = await questionDiv.$eval(
      '.QuestionText.BorderColor',
      element => {
        return element.textContent.includes('Do you have a NYU NetID');
      },
    );

    if (!rightQuestion) {
      throw new Error('Wrong question');
    }

    let questionChoiceInput = await questionDiv.$('input.QR-QID2-1');

    if (!questionChoiceInput) {
      throw new Error('Question choice input not found');
    }

    await questionChoiceInput.click();

    await page.waitForTimeout(500);

    let nextButton2 = await page.$('#NextButton');
    if (!nextButton2) {
      throw new Error('Next button not found');
    }
    await nextButton2.click();

    await page.waitForTimeout(2000);

    await page.screenshot({path: 'screenshot.png'});

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
    await loginButton.click();

    await page.waitForFunction(
      `
      document.body && document.body.textContent.includes('Screener Status:')
    `,
      {timeout: 30000},
    );
    await page.waitForTimeout(1000);
    await page.screenshot({path: 'screenshot.png'});
  } finally {
    await browser.close();
  }
}
