/**
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {helper}  from './lib/helper';
import fs  from 'fs';
import path from 'path';
import sharp from 'sharp';


import '../lib/index.js';
import {Base64} from '../lib/utils';
import EXAMPLE_CONTRACT from './example-data/Contract.json' 
import fse from 'fs-extra';

console.log('Example contract is ' + EXAMPLE_CONTRACT);

const encodedContract = Base64.encode(JSON.stringify(EXAMPLE_CONTRACT));
const filePath = `${__dirname}/../output/${encodedContract}/screens/${encodedContract}.png`;

const TIMEOUT = 3000;

export const addTests = ({testRunner, expect}) => {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner; 
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;

  describe('Proxy Browsing', function() {
    it('Ensure Tag Reports Same Events As Chrome', async({page, httpsServer}) => {
      const requests = [];
      page.on('request', request => requests.push(request));
      const finalUrl = path.join(httpsServer.PREFIX, `/${encodedContract}`);
      console.log(`Going to ${finalUrl} `);
      await page.goto(finalUrl, {waitUntil:'domcontentloaded'});
      console.log(`Disabling cache`);
      await page.setCacheEnabled(false);
      console.log(`Waiting for ${TIMEOUT} seconds for the page content to load`);
      await new Promise(f => setTimeout(f, TIMEOUT * 1000));
      console.log(`Taking screenshot of ${URL}`);
      let imgBuff = await page.screenshot({fullPage: true});
      imgBuff = await sharp(imgBuff).resize(undefined, 2000).toBuffer(); // resize image to 150 x auto. 
      console.log(`Writing screenshot of ${URL} to ${filePath}`);
      helper.promisify(fse.writeFile)(filePath, imgBuff); // async
      page.img = `data:img/png;base64,${imgBuff.toString('base64')}`;
      const requestsFromTagString= await page.evaluate(() => measure());
      const requestsFromTag = JSON.parse(requestsFromTagString);
      for (i = 0; i < requestsFromTag.length; i++)
      {
          const request = requestsFromTag[i];
          if(request.initiatorType === 'iframe'){
            console.log(JSON.stringify(requestsFromTag[i]));
          }
      }
      const noRequestsFromTag = requestsFromTag.length;
      console.log(`Chrome driver reported  ${requests.length} requests tag reported ${noRequestsFromTag}`);
      expect(noRequestsFromTag).toBe(requests.length);
    });
  });
};

function slugify(str) {
  return str.replace(/[\/:]/g, '_');
}
/**
 * @param {string} path
 * @return {string}
 */
function pathToFileURL(path) {
  let pathName = path.replace(/\\/g, '/');
  // Windows drive letter must be prefixed with a slash.
  if (!pathName.startsWith('/'))
    pathName = '/' + pathName;
  return 'file://' + pathName;
}
