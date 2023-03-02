export class YemotRequest {
    params: any;
    dataSource: any;
    async getLessonFromLessonId(lessonId: string) {
        return { lessonId };
    }
    async getTeacherByPhone(phone: string) {
        return { name: 'teacher', phone };
    }
    async getStudentsByUserIdAndKlassIds(userId: number, klassId: number) {
        return [{ tz: '123' }, { tz: '456' }];
    }
    saveReport(attReport: any) {
        // todo
    }
    deleteExistingReports(existingReports: any) {
        // todo
    }
}
export class YemotResponse {
    send(msg: string) { }
};

export interface IHandler {
    handleRequest: (req: YemotRequest, res: YemotResponse, callback: Function) => Promise<any>;
}

export class Chain implements IHandler {
    handlers: IHandler[];

    constructor(handlers: IHandler[] = []) {
        this.handlers = handlers;
    }

    async handleRequest(req: YemotRequest, res: YemotResponse, callback: Function) {
        let index = 0;
        const next = async () => {
            if (index < this.handlers.length) {
                const handler = this.handlers[index];
                index++;
                // console.log('handler name:', handler.constructor.name)
                await handler.handleRequest(req, res, (handled: Boolean) => {
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