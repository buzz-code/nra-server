import { YemotCall } from "../YemotCall.entity";
import { User } from "../User.entity";

class MockUser extends User {}

describe("YemotCall Entity", () => {
    let mockYemotCall: YemotCall;

    beforeEach(() => {
        mockYemotCall = new YemotCall();
    });

    it("should create a YemotCall instance", () => {
        expect(mockYemotCall).toBeInstanceOf(YemotCall);
    });

    it("should have properties set correctly", () => {
        mockYemotCall.userId = 1;
        mockYemotCall.apiCallId = "api_call_123";
        mockYemotCall.phone = "123456789";
        mockYemotCall.history = [{ time: new Date(), response: "response" }];
        mockYemotCall.currentStep = "step_1";
        mockYemotCall.data = { key: "value" };
        mockYemotCall.isOpen = true;
        mockYemotCall.hasError = false;

        expect(mockYemotCall.userId).toBe(1);
        expect(mockYemotCall.apiCallId).toBe("api_call_123");
        expect(mockYemotCall.phone).toBe("123456789");
        expect(mockYemotCall.history).toEqual([{ time: expect.any(Date), response: "response" }]);
        expect(mockYemotCall.currentStep).toBe("step_1");
        expect(mockYemotCall.data).toEqual({ key: "value" });
        expect(mockYemotCall.isOpen).toBe(true);
        expect(mockYemotCall.hasError).toBe(false);
    });

    it("should handle nullable fields correctly", () => {
        mockYemotCall.data = null;
        mockYemotCall.errorMessage = null;

        expect(mockYemotCall.data).toBeNull();
        expect(mockYemotCall.errorMessage).toBeNull();
    });

    it("should correctly relate to User entity", () => {
        const mockUser = new MockUser();
        mockUser.name = "Test User";

        mockYemotCall.user = mockUser;

        expect(mockYemotCall.user).toEqual(mockUser);
    });
});
