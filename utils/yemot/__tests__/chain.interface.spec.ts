import { Chain, Handler, HandlerBase, IHandler } from "../chain.interface";
import { YemotRequest, YemotResponse } from "../yemot.interface";

const req = new YemotRequest({} as any, {} as any);
const res = new YemotResponse();

describe('Chain', () => {

    // Given a Chain instance with one handler, when calling handleRequest with a YemotRequest and YemotResponse, then the handler should be called and callback should be called
    it('should call handler and callback', (done) => {
        const chain = new Chain();
        const handler: IHandler = {
            handleRequest: jest.fn().mockImplementation((req, res, callback) => {
                callback(true);
            })
        };
        chain.addHandler(handler);

        chain.handleRequest(req, res, () => {
            expect(handler.handleRequest).toHaveBeenCalledTimes(1);
            done();
        });
    });

    // Given a Chain instance with multiple handlers, when calling handleRequest with a YemotRequest and YemotResponse, then each handler should be called in order and callback should be called
    it('should call each handler in order and callback', (done) => {
        const chain = new Chain();
        const handler1: IHandler = {
            handleRequest: jest.fn().mockImplementation((req, res, callback) => {
                callback(false);
            })
        };
        const handler2: IHandler = {
            handleRequest: jest.fn().mockImplementation((req, res, callback) => {
                callback(true);
            })
        };
        chain.addHandler(handler1);
        chain.addHandler(handler2);

        chain.handleRequest(req, res, () => {
            expect(handler1.handleRequest).toHaveBeenCalledTimes(1);
            expect(handler2.handleRequest).toHaveBeenCalledTimes(1);
            done();
        });
    });

    // Given a Chain instance with no handlers, when calling handleRequest with a YemotRequest and YemotResponse, then callback should be called
    it('should call callback when no handlers', (done) => {
        const chain = new Chain();

        chain.handleRequest(req, res, () => {
            done();
        });
    });

    // Given a Chain instance with a handler that throws an error, when calling handleRequest with a YemotRequest and YemotResponse, then the error should be propagated and callback should not be called
    it('should propagate error when handler throws an error', (done) => {
        const chain = new Chain();
        const handler: IHandler = {
            handleRequest: jest.fn().mockImplementation((req, res, callback) => {
                throw new Error('Handler error');
            })
        };
        chain.addHandler(handler);

        expect(() => {
            return chain.handleRequest(req, res, () => {
                done.fail('Callback should not be called');
            });
        }).rejects.toThrowError('Handler error');

        expect(handler.handleRequest).toHaveBeenCalledTimes(1);
        done();
    });

    it('should call callback when no handlers', (done) => {
        class MockHandler extends HandlerBase { }

        const handler = new MockHandler();
        const chain = new Chain();
        chain.addHandler(handler);
        const next = jest.fn();

        chain.handleRequest(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        done();
    });

    it('should use handler class', (done) => {
        const handle = jest.fn();
        const handler = new Handler(handle);
        expect(handler.handleRequest).toBe(handle);
        done();
    });
});
