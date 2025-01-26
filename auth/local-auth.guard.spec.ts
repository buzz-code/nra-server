import { LocalAuthGuard } from './local-auth.guard';
import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';

// Need to mock the whole module since AuthGuard is a function that returns a class
jest.mock('@nestjs/passport', () => {
  class MockAuthGuard {
    canActivate(context: ExecutionContext) {
      return true;
    }
  }

  return {
    AuthGuard: jest.fn().mockImplementation(() => MockAuthGuard),
  };
});

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(() => {
    guard = new LocalAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should have canActivate method', () => {
    expect(guard.canActivate).toBeDefined();
    expect(typeof guard.canActivate).toBe('function');
  });

  it('should use local strategy', () => {
    const { AuthGuard } = require('@nestjs/passport');
    expect(AuthGuard).toHaveBeenCalledWith('local');
  });
});