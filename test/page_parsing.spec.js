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
import Autolinker from 'autolinker';


import '../lib/index.js';
import {Base64,UrlMatcherLib} from '../lib/utils';
import fse from 'fs-extra';

const EXAMPLE_FILE = fs.readFileSync('./test/example-data/example-file.html');

export const addTests = ({testRunner, expect}) => {
  const {describe, xdescribe, fdescribe} = testRunner;
  const {it, fit, xit} = testRunner; 
  const {beforeAll, beforeEach, afterAll, afterEach} = testRunner;
  const regex = UrlMatcherLib.matcherRegex();

  describe('Page Parsing', function() {
    it('Can Parse Urls Out of page quickly', async({page, server}) => {
        if(!EXAMPLE_FILE){
            throw new Error('Expecting file to exist. It does not')
        }
        let text = EXAMPLE_FILE + '';
        let filePath = './test/example-data/example-file-out.html'
        var start = Date.now();
        var re = /\s*([^[:]+):\"([^"]+)"/g;
        var s = '[description:"aoeu" uuid:"123sth"]';
        var match;
        

        var length = Date.now() - start;
        console.log('Replaced contents of ' + filePath + ' in ' + length + 'millis');
        await fse.outputFile(filePath, text); 
    });
  });
};

function slugify(str) {
  return str.replace(/[\/:]/g, '_');
}
