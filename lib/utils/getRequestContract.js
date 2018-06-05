import invariant from 'invariant';
import base64 from './base64';
export const getRequestContract = (request) => {
    try{
        invariant(request && request.url, 'Request URL should be defined');
        invariant(request.url.length > 1, 'Request should contain hash'); 
        let encodedUrl = request.url.substring(1);
        const decodedContract = base64.decode(encodedUrl)
        const result = JSON.parse(decodedContract);
        result.uniqueHash = encodedUrl;
        return result;
    }catch(error){
        return;
    }
}