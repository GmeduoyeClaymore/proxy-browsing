import HeadlessNodeSession from './HeadlessNodeSession';
import {getCookies, getRequestContract} from './utils';


export default class HeadlessNodeHandler{ 
    constructor(dirPath, serverDomain){
        this.dirPath = dirPath;
        this.serverDomain = serverDomain; 
        this.sessionsForKey = {};
    }

    getOrCreateSessionForRequest = async (request) => {
        const contract = getRequestContract(request);
        let key;
        if(!contract){
            const cookies = getCookies(request.headers.cookie);
            key = cookies.UniqueId;
        }else{
            key = contract.UniqueId; 
        }
        if(!key){
            throw new Error('Unable to find unique id for request');
        }
        let session = this.sessionsForKey[key];
        if(!session && !contract){
            throw new Error('We need a request contract to create a session !!!!');
        }
        if(!session){
            session = new HeadlessNodeSession(key, this.dirPath, this.serverDomain, contract.baseDomain);
            this.sessionsForKey[key] = session;
            await session.start();
        } 
        return session;
    }

    handle = async (request, response) => {
        try{
            const session = await this.getOrCreateSessionForRequest(request);
            await session.handle(request,response);
        }catch(error){
            response.end(error+'');
        }
    }
} 