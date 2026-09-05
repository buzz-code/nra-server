import { YemotRequest, YemotResponse } from "./yemot.interface";

export interface IHandler {
    handleRequest: (req: YemotRequest, res: YemotResponse, callback: Function) => Promise<any>;
}

export class Chain implements IHandler {
    constructor(private name = 'unknown', public handlers: IHandler[] = []) { }

    async handleRequest(req: YemotRequest, res: YemotResponse, callback: Function) {
        let index = 0;
        const next = async () => {
            if (index < this.handlers.length) {
                const handler = this.handlers[index];
                index++;
                return handler.handleRequest(req, res, (handled: Boolean) => {
                    if (handled) {
                        return callback();
                    } else {
                        return next();
                    }
                });
            } else {
                return callback();
            }
        };
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