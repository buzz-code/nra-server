import { LocalRegisterAuthGuard } from '../local-register-auth.guard';

// Export mock function to verify calls
const mockAuthGuard = jest.fn(() => {
  return class MockAuthGuard {
    canActivate() {
      return true;
    }
  };
});

jest.mock('@nestjs/passport', () => ({
  AuthGuard: mockAuthGuard
}));

describe('LocalRegisterAuthGuard', () => {
  it('should use local-register strategy', () => {
    // Force class re-evaluation to trigger AuthGuard call
    jest.isolateModules(() => {
      jest.resetModules();
      require('../local-register-auth.guard');
    });
    expect(mockAuthGuard).toHaveBeenCalledWith('local-register');
  });
});