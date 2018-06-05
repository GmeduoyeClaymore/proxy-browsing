import puppeteer from 'puppeteer';
import readline from 'readline';
import {getRequestContract,urlMatcher} from './utils';
import path from 'path';
import mime from 'mime';
import fse from 'fs-extra';
import Autolinker from 'autolinker';
const Rx =  require('rxjs/Rx');

const executablePath = process.env.CHROME;
const defaultBrowserOptions = { 
    executablePath,
    headless: true,
    dumpio: false,
    args: ['--no-sandbox']
};

export default class HeadlessNodeSession{

    constructor(uniqueId, dirPath, serverDomain, baseDomain){
        this.uniqueId = uniqueId;
        this.dirPath = dirPath;
        this.longNames = {};  
        this.baseDomain = baseDomain;
        this.pageNamesToSourceUrlMap = {};
        this.serverDomain = serverDomain;
        this.domainFilePath = path.join(this.dirPath,`domains.json`);
        this.domainPatternsFilePath = path.join(this.dirPath,`domain_patterns.json`);
        this.domainPatterns = this.readDomainsFromDisk(this.domainPatternsFilePath);
        this.domainsInSession = this.readDomainsFromDisk(this.domainFilePath);
        this.domainRegex = this.calculateDomainRegex();
        this.savedFiles = [];
        this.errorFiles = {};
        this.fileSavedSubject = new Rx.Subject();
        this.domainsUpdatedSubject = new Rx.Subject();
        this.domainsUpdatedSubject.debounceTime(500).subscribe(this.updateDomainsOnFileSystem);
    }

    calculateDomainRegex = () => {
        if((!this.domainsInSession || !this.domainsInSession.length) && (!this.domainPatterns || !this.domainPatterns.length) ){
            return;
        }
        let regexString;
        
        if(this.domainsInSession){
            regexString= this.domainsInSession.map(this.escapeDomain).join('|'); 
        }
        if(this.domainPatterns && this.domainPatterns.length){
            if(regexString && regexString.length){
                regexString = regexString + '|';
            }
            regexString = regexString+ this.domainPatterns.map(this.wrapPattern).join('|'); 
        }
        //console.log('Domain regex is ' + regexString)
        return new RegExp(regexString,'gi')
    }

    escapeDomain = (domain) => { 
        return '('+domain.replace(new RegExp('\\.','gi'),'\\.').replace(new RegExp('\-','gi'),'\\-')+')';   
    }

    wrapPattern = (pattern) => {
        return '('+pattern+')'; 
    }
   
    readDomainsFromDisk = (filePath) => {
        try{
            const domainFileText = fse.readFileSync(filePath)+''; 
            return domainFileText.split('\n').filter(el => el && el.length);   
        }
        catch(error){
            console.error(`Problem reading domain file ${this.domainFilePath}`);
            return []; 
        }
    }

    start = async() => { 
        this.browser = await puppeteer.launch(defaultBrowserOptions);
        this.page = await this.browser.newPage(); 
        const rl = readline.createInterface({input: this.browser.process().stderr});
        rl.on('line', onLine); 
        this.tearDown = () => { 
            rl.removeListener('line', onLine);    
            rl.close();
        };
        function onLine(line) {
            console.log(line);   
        }
    }

    waitForFileSaved = async (filePath) => {
        filePath =  this.cleanFileName(filePath);
        if(!!~this.savedFiles.indexOf(filePath)){
            return {filePath};
        }
        if(this.errorFiles[filePath]){
            return this.errorFiles[filePath];
        }
        console.log('Waiting for ' + filePath + ' to be saved');
        try{
            return await this.fileSavedSubject.filter(c => path === c.filePath).take(1).timeoutWith(10000, Rx.Observable.throw(Error('File ' + filePath + ' not retrieved in 10 seconds'))).toPromise();
        }catch(error){
            this.errorFiles[filePath] = error;
            throw error;
        }
    }

    onFileSaved = (filePath) => {
        if(!~this.savedFiles.indexOf(filePath)){
            this.savedFiles.push(filePath);
        }
        this.fileSavedSubject.next({filePath});
    }

    onFileError = (filePath,error) => {
        if(this.errorFiles[filePath]){
           this.errorFiles[filePath] = error;
        }
        this.fileSavedSubject.next({filePath, error});
    }

    canHandle = (response) => {
        const contentType = response._headers['content-type']; 
        if(!contentType || !contentType.startsWith('image')){
            //console.log(`CAN HANDLE !!! Content type is ${contentType}`);
            return true;
        }
        //console.log(`CANT HANDLE !!! Content type is ${contentType}`);
        return false;
    }

    processResultPage = async (pageText) => {
        let result = pageText;//pageText.replace('<head>',`<head><script>window.tagUrl='${tagUrl}';</script><script src='${tagUrl}'/>`);
        //result = this.replaceIframesWithMyFrames(result);
        //result = this.replaceScriptTagsWithMyScriptTags(result);
        return result;  
    }

    updateDomainsOnFileSystem = async () => {
        await fse.outputFile(this.domainFilePath, this.domainsInSession.join('\n')); 
    }

    handlePageResource = async(response) => {
        const url = new URL(response.url());
        let filePath = path.resolve(`output/${this.uniqueId}/${this.getFileName(url)}`);
        console.log('Trying to save ' + filePath);
        try{
            if(url.hostname && (!this.domainRegex || !url.hostname.match(this.domainRegex)) && (!~this.domainsInSession.indexOf(url.hostname))){
                console.log('Adding domain ' + url.hostname);
                this.domainRegex = this.calculateDomainRegex(); 
                this.domainsInSession.push(url.hostname)
                this.domainsUpdatedSubject.next();
                await fse.outputFile(this.domainFilePath, this.domainsInSession.join('\n')); 
            }
            const {serverDomain} = this;
          

            if(this.canHandle(response)){
                console.log('Trying to save with modifications ' + filePath);
                let text  = await response.text();   
                text = text.replace(this.domainRegex,this.serverDomain);
                await fse.outputFile(filePath, text); 
                this.onFileSaved(filePath);
            }else{
                console.log('Trying to save without modifications ' + filePath);
                //console.log(`CANT HANDLE file ${filePath} !!! Content type is ${contentType}`);
                await fse.outputFile(filePath, await response.buffer()); 
                this.onFileSaved(filePath);
            }
            this.pageNamesToSourceUrlMap[filePath] = url;
        }catch(err){ 
            this.errorFiles[filePath] = err;
            //console.error(`Problem saving ${response.url().substring(0,100)} to disk`)
        }
    }

    getFileName = (url) => {
        let fileName = url.pathname;
        if(!fileName){
            return fileName;
        }
        if(fileName.length > 100){
            fileName = this.longNames[url.pathName];
            if(!fileName){
                fileName = Object.keys(this.longNames).length + "_longName";
                this.longNames[url.pathName] = fileName;
            }
        }
        return fileName; 
    }



    handle = async (request, response) =>{
        const requestContract = getRequestContract(request);
        response.setHeader("Set-Cookie",`UniqueId=${this.uniqueId}; HttpOnly`);
        let shouldServeFromFileSystem = !requestContract;
        const pageUrl = this.getPathFromUrl(request.url);
        let filePath = path.join(this.dirPath,this.uniqueId, pageUrl);

        if(requestContract){
            filePath = path.join(this.dirPath,this.uniqueId, this.getPathFromUrl(new URL(requestContract.finalUrl).pathname));
            shouldServeFromFileSystem = fse.pathExistsSync(filePath);
        }
       
        if(shouldServeFromFileSystem){
            await this.serveFile(request, response, filePath);
        }else{
            const cookiesList = requestContract.cookies || [];
            const headers = requestContract.header; 
            const body = requestContract.body; 
            const method = requestContract.method;
            const finalUrl = requestContract.finalUrl;
            const cookies = cookiesList.map(cookie => `${cookie.name}=${cookie.value}`).join('; ')
        
            const requestContent = {
                body,
                headers: headers,
                method: method,
                cookiesList,
                follow: 20,
            } 
            this.page.on('response', this.handlePageResource);
            const result = await this.page.goto(finalUrl, {waitUntil:'domcontentloaded'});
            const savedFileResult = await this.waitForFileSaved(filePath);
            if(savedFileResult.error){
                console.error(savedFileResult.error);
                return;
            }
            await this.serveFile(request, response, filePath);
        }
    }

    getPathFromUrl = (url) => {
        if(!url){
            return url;
        }
        url = this.cleanFileName(url);
        return url.split("?")[0];
    }

    cleanFileName = (fileName) => {
        if(fileName.endsWith('/')){
            fileName = fileName.substring(0,fileName.length -1);
        }
        return fileName;
    }

    serveFile = async (request, response, filePath, times = 0) => {
        filePath = this.cleanFileName(filePath);

        if(times > 10){
            console.error(`Tried fo serve file ${filePath} 10 times with no luck aborting`)
            return;
        }

        if(!fse.pathExistsSync(filePath)){
            console.log(`File ${filePath} doesn't exsit am requesting it`)
            let urlForFilePath = this.pageNamesToSourceUrlMap[filePath];
            
            if(!urlForFilePath){
                urlForFilePath = path.join(this.baseDomain,request.url);
            }
            console.log(`Requesting URL ${urlForFilePath} for file path ${filePath}`)
            const result = await this.page.goto(urlForFilePath, {waitUntil:'domcontentloaded'});
            console.log(`Got result from URL ${urlForFilePath} for file path ${filePath}`)
            try{
                const result = await this.waitForFileSaved(filePath);
                if(result.error){
                    console.error(result.error);
                    return;
                }
                const processResultPage = this.processResultPage;
                fse.readFile(filePath, async function(err, data) {
                if (err) {
                    response.statusCode = 404; 
                    response.end(`File not found: ${filePath}`);
                    return;
                }
                response.setHeader('Content-Type', mime.getType(filePath)); 
                const resultData = await processResultPage(data);
                response.end(resultData); 
                });
            }catch(error){
                console.error(error);
                return;
            }
        }

        if (this._cachedPathPrefix !== null && filePath.startsWith(this._cachedPathPrefix)) { 
          if (request.headers['if-modified-since']) {
            response.statusCode = 304; // not modified 
            response.end();
            return;
          }
          response.setHeader('Cache-Control', 'public, max-age=31536000');
          response.setHeader('Last-Modified', this._startTime.toString());
        } else {
          response.setHeader('Cache-Control', 'no-cache, no-store'); 
        }

        const processResultPage = this.processResultPage;
        fse.readFile(filePath, async function(err, data) {
          if (err) {
            response.statusCode = 404; 
            response.end(`File not found: ${filePath}`);
            return;
          }
          response.setHeader('Content-Type', mime.getType(filePath)); 
          const resultData = await processResultPage(data);
          response.end(resultData); 
        });
    }

    tearDown = () => {
        this.tearDown();
    }
}
