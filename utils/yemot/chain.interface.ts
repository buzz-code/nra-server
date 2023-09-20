import { YemotRequest, YemotResponse } from "./yemot.interface";

export interface IHandler {
    handleRequest: (req: YemotRequest, res: YemotResponse, callback: Function) => Promise<any>;
}

export class Chain implements IHandler {
    constructor(private name = 'unknown', private handlers: IHandler[] = []) { }

    async handleRequest(req: YemotRequest, res: YemotResponse, callback: Function) {
        let index = 0;
        const next = async () => {
            if (index < this.handlers.length) {
                const handler = this.handlers[index];
                index++;
                // console.log('handler name:', handler.constructor.name)
                return handler.handleRequest(req, res, (handled: Boolean) => {
                    if (handled) {
                        // console.log('going to return callback() on handled: true', this.name)
                        return callback();
                    } else {
                        // console.log('going to return next() on handled: false', this.name)
                        return next();
                    }
                });
            } else {
                // console.log('going to return callback() on handlers end', this.name)
                return callback();
            }
        };
        // console.log('going to return next() on handle request', this.name)
        return next();
    }

    addHandler(handler: IHandler) {
        this.handlers.push(handler);
    }
}

export abstract class HandlerBase implements IHandler {
    handleRequest(req: YemotRequest, res: YemotResponse, callback: Function): any {
        return callback();
    };
}

export class Handler extends HandlerBase {
    constructor(handleRequest: IHandler['handleRequest']) {
        super();
        this.handleRequest = handleRequest;
    }
}