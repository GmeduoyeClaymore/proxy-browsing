import http from 'http';
import assert from 'assert';

import '../lib/index.js';
import {Base64} from '../lib/utils';
import EXAMPLE_CONTRACT from './example-data/Contract.json'

describe('Headless Node Server Example', () => {
  it('Should request example contract', done => {
    http.get(`http://locaslhost:${port}/${Base64.encode(EXAMPLE_CONTRACT)}`, res => {
      assert.equal(200, res.statusCode);
      done();
    });
  });
});
