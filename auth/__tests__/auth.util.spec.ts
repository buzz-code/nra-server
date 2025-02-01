import { getUserIdFromUser } from "../auth.util";

describe('getUserIdFromUser', () => {
    it('get undefined if user is null', () => {
        expect(getUserIdFromUser(null)).toBeUndefined();
    })

    it('get undefined if user is admin', () => {
        expect(getUserIdFromUser({ permissions: { admin: true } })).toBeUndefined();
    })

    it('get effective_id if user is not admin', () => {
        expect(getUserIdFromUser({ effective_id: 1 })).toBe(1);
    })

    it('get id if user is not admin and effective_id is not defined', () => {
        expect(getUserIdFromUser({ id: 1 })).toBe(1);
    })

    it('get undefined if user is not admin and effective_id and id are not defined', () => {
        expect(getUserIdFromUser({})).toBeUndefined();
    })
})