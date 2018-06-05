/**
 * Copyright 2017 Google Inc. All rights reserved.
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
import http from 'http';
import https from 'https';
import url from 'url';
import fs from 'fs';
import path from 'path';
import mime from 'mime';
import {Server as WebSocketServer} from 'ws';
import HeadlessNodeHandler from './HeadlessNodeHandler';
import {getCookies, getRequestContract} from './utils';

const fulfillSymbol = Symbol('fullfil callback');
const rejectSymbol = Symbol('reject callback');

export default class HeadlessNodeServer {
  /**
   * @param {string} dirPath
   * @param {number} port
   * @return {!SimpleServer}
   */
  static async create(domain, dirPath, port) {
    console.log(`Creating server on port:${port}`)
    const server = new HeadlessNodeServer(domain, dirPath, port);
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  /**
   * @param {string} dirPath
   * @param {number} port
   * @return {!SimpleServer}
   */
  static async createHTTPS(domain, dirPath, port) {
    const server = new HeadlessNodeServer(domain, dirPath, port, {
      key: fs.readFileSync(path.join(__dirname, 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'cert.pem')),
      passphrase: 'aaaa',
    });
    await new Promise(x => server._server.once('listening', x));
    return server;
  }

  /**
   * @param {string} dirPath
   * @param {number} port
   * @param {!Object=} sslOptions
   */
  constructor(domain, dirPath, port, sslOptions) {
    if (sslOptions)
      this._server = https.createServer(sslOptions, this._onRequest.bind(this));
    else
      this._server = http.createServer(this._onRequest.bind(this));
    this._server.on('connection', socket => this._onSocket(socket));
    this._wsServer = new WebSocketServer({server: this._server});
    this._wsServer.on('connection', this._onWebSocketConnection.bind(this));
    this._server.listen(port);
    this._dirPath = dirPath;
    this._domain = domain;

    this._startTime = new Date();
    this._cachedPathPrefix = null;
    this._handler = new HeadlessNodeHandler(this._dirPath, this._domain); 
    this._auths = new Map();
    this._csp = new Map();
    /** @type {!Set<!net.Socket>} */
    this._sockets = new Set();
  }

  _onSocket(socket) {
    this._sockets.add(socket);
    // ECONNRESET is a legit error given
    // that tab closing simply kills process.
    socket.on('error', error => {
     // if (error.code !== 'ECONNRESET')
       // throw error;
    }); 
    socket.once('close', () => this._sockets.delete(socket));
  }

  /**
   * @param {string} pathPrefix
   */
  enableHTTPCache(pathPrefix) {
    this._cachedPathPrefix = pathPrefix;
  }

  /**
   * @param {string} path
   * @param {string} username
   * @param {string} password
   */
  setAuth(path, username, password) {
    this._auths.set(path, {username, password});
  }

  /**
   * @param {string} path
   * @param {string} csp
   */
  setCSP(path, csp) {
    this._csp.set(path, csp);
  }

  async stop() {
    this.reset();
    for (const socket of this._sockets)
      socket.destroy();
    this._sockets.clear();
    await new Promise(x => this._server.close(x));
  }

  /**
   * @param {string} path
   * @param {function(!IncomingMessage, !ServerResponse)} handler
   */
  setRoute(path, handler) {
    this._routes.set(path, handler);
  }

  /**
   * @param {string} from
   * @param {string} to
   */
  setRedirect(from, to) {
    this.setRoute(from, (req, res) => {
      res.writeHead(302, { location: to });
      res.end();
    });
  }

  /**
   * @param {string} path
   * @return {!Promise<!IncomingMessage>}
   */
  waitForRequest(path) {
    let promise = this._requestSubscribers.get(path);
    if (promise)
      return promise;
    let fulfill, reject;
    promise = new Promise((f, r) => { 
      fulfill = f;
      reject = r;
    });
    promise[fulfillSymbol] = fulfill;
    promise[rejectSymbol] = reject;
    this._requestSubscribers.set(path, promise);
    return promise;
  }

  reset() {
    this._auths.clear();
    this._csp.clear(); 
    const error = new Error('Static Server has been reset');
  }

  _onRequest(request, response) {
    request.on('error', error => { 
      if (error.code === 'ECONNRESET') {
        response.end();
      }  
      //else
        //throw error;
    });

    this._handler.handle(request, response);
  }
 
  _onWebSocketConnection(connection) {
    connection.send('opened');
  }
}
