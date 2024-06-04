jest.mock('nestjs-request-context', () => ({
    RequestContext: {
        currentContext: {
            req: {
                user: {
                    id: 1,
                },
            },
        },
    },
}));

import { getCurrentUser } from './util';

describe('getCurrentUser', () => {
    it('should return the current user', () => {
        expect(getCurrentUser()).toEqual({
            id: 1,
        });
    });
})
