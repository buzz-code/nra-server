import { REQUEST_ID_HEADER, requestIdMiddleware } from '../request-id.middleware';

describe('requestIdMiddleware', () => {
  it('reuses an incoming X-Request-Id header', () => {
    const req: any = { headers: { 'x-request-id': 'incoming-id' } };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.id).toBe('incoming-id');
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'incoming-id');
    expect(next).toHaveBeenCalled();
  });

  it('generates a request id when none was sent', () => {
    const req: any = { headers: {} };
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.id).toEqual(expect.any(String));
    expect(req.id.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, req.id);
    expect(next).toHaveBeenCalled();
  });
});
