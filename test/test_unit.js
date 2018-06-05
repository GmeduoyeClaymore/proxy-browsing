/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import fs from 'fs';
import {sync as rm} from 'rimraf';
import path from 'path';
import HeadlessNodeServer from '../lib/HeadlessNodeServer';
import TestRunner from './TestRunner';
import Reporter from './Reporter';
import Matchers from './Matchers';
import readline from 'readline';

const GOLDEN_DIR = path.join(__dirname, 'golden');
const OUTPUT_DIR = path.join(__dirname, 'output');

const YELLOW_COLOR = '\x1b[33m';
const RESET_COLOR = '\x1b[0m';

const headless = (process.env.HEADLESS || 'true').trim().toLowerCase() === 'true';
const executablePath = process.env.CHROME;
const extensionPath = path.resolve(__dirname, '../test/assets/simple-extension');

const parallel = false;
const testRunner = new TestRunner({timeout: 0, parallel});
const {expect} = new Matchers({
});
const {describe, it, xit, beforeAll, afterAll, beforeEach, afterEach} = testRunner;

if (fs.existsSync(OUTPUT_DIR))
  rm(OUTPUT_DIR);

console.log('Testing on Node', process.version);

beforeAll(async state => {
});

afterAll(async({server, httpsServer}) => {
});

beforeEach(async({server, httpsServer}) => {
});


// Top-level tests that launch Browser themselves.
require('./page_parsing.spec.js').addTests({testRunner, expect});

if (process.env.CI && testRunner.hasFocusedTestsOrSuites()) {
  console.error('ERROR: "focused" tests/suites are prohibitted on bots. Remove any "fit"/"fdescribe" declarations.');
  process.exit(1);
}

new Reporter(testRunner);
testRunner.run();
