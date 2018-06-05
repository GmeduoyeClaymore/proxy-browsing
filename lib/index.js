import http from 'http';

import fs from 'fs';
import path  from 'path';
import HeadlessNodeServer  from './HeadlessNodeServer';

const assetsPath = path.join(__dirname, 'assets');
const cachedPath = path.join(__dirname, 'assets', 'cached');
export const port = 8907;

class ServerRunner{
  constructor(){
  }

  async doStart(){
    console.log("Starting server");
    await this.start();
  }
    
  async start(){ 
    console.log("Starting server too");
    console.log(`Creating server on port:${port}`)    
    const server = new HeadlessNodeServer(`localhost:${port}`,assetsPath, port);   
    await new Promise(x => server._server.once('listening', x));
    console.log(`HTTP: server is running on http://localhost:${port}`);
  }
}

const serverRunner = new ServerRunner();
serverRunner.doStart();

