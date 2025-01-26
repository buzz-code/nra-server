import { CrudAuthFilter, CrudAuthAdminFilter, CrudAuthWithPermissionsFilter, CrudAuthReadOnlyWithPermissionFunc } from './crud-auth.filter';
import { getUserIdFromUser } from './auth.util';

// Mock getUserIdFromUser since we don't want to test its implementation here
jest.mock('./auth.util', () => ({
  getUserIdFromUser: jest.fn().mockReturnValue(123)
}));

describe('CrudAuthFilter', () => {
  const adminUser = {
    id: 1,
    permissions: { admin: true }
  };

  const regularUser = {
    id: 123,
    permissions: { admin: false }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('CrudAuthFilter', () => {
    it('should return empty object for admin user', () => {
      const result = CrudAuthFilter.filter(adminUser);
      expect(result).toEqual({});
    });

    it('should return userId filter for non-admin user', () => {
      const result = CrudAuthFilter.filter(regularUser);
      expect(getUserIdFromUser).toHaveBeenCalledWith(regularUser);
      expect(result).toEqual({ userId: 123 });
    });
  });

  describe('CrudAuthAdminFilter', () => {
    it('should return empty object for admin user', () => {
      const result = CrudAuthAdminFilter.filter(adminUser);
      expect(result).toEqual({});
    });

    it('should return id: -1 for non-admin user', () => {
      const result = CrudAuthAdminFilter.filter(regularUser);
      expect(result).toEqual({ id: -1 });
    });
  });

  describe('CrudAuthWithPermissionsFilter', () => {
    it('should return empty object for admin user regardless of permission function', () => {
      const permissionFunc = jest.fn().mockReturnValue(false);
      const filter = CrudAuthWithPermissionsFilter(permissionFunc);
      const result = filter.filter(adminUser);

      expect(result).toEqual({});
      expect(permissionFunc).not.toHaveBeenCalled();
    });

    it('should return empty object when permission function returns true', () => {
      const permissionFunc = jest.fn().mockReturnValue(true);
      const filter = CrudAuthWithPermissionsFilter(permissionFunc);
      const result = filter.filter(regularUser);

      expect(result).toEqual({});
      expect(permissionFunc).toHaveBeenCalledWith(regularUser.permissions);
    });

    it('should return id: -1 when permission function returns false', () => {
      const permissionFunc = jest.fn().mockReturnValue(false);
      const filter = CrudAuthWithPermissionsFilter(permissionFunc);
      const result = filter.filter(regularUser);

      expect(result).toEqual({ id: -1 });
      expect(permissionFunc).toHaveBeenCalledWith(regularUser.permissions);
    });
  });

  describe('CrudAuthReadOnlyWithPermissionFunc', () => {
    it('should return empty object for admin user regardless of permission function', () => {
      const permissionFunc = jest.fn().mockReturnValue(false);
      const filter = CrudAuthReadOnlyWithPermissionFunc(permissionFunc);
      const result = filter.persist(adminUser);

      expect(result).toEqual({});
      expect(permissionFunc).not.toHaveBeenCalled();
    });

    it('should return empty object when permission function returns true', () => {
      const permissionFunc = jest.fn().mockReturnValue(true);
      const filter = CrudAuthReadOnlyWithPermissionFunc(permissionFunc);
      const result = filter.persist(regularUser);

      expect(result).toEqual({});
      expect(permissionFunc).toHaveBeenCalledWith(regularUser.permissions);
    });

    it('should return id: "break" when permission function returns false', () => {
      const permissionFunc = jest.fn().mockReturnValue(false);
      const filter = CrudAuthReadOnlyWithPermissionFunc(permissionFunc);
      const result = filter.persist(regularUser);

      expect(result).toEqual({ id: 'break' });
      expect(permissionFunc).toHaveBeenCalledWith(regularUser.permissions);
    });
  });

  describe('edge cases', () => {
    it('should handle users with undefined permissions', () => {
      const userWithoutPermissions = { id: 1 };
      expect(() => CrudAuthFilter.filter(userWithoutPermissions)).toThrow();
    });

    it('should handle permission functions that throw errors', () => {
      const throwingPermissionFunc = () => { throw new Error('Permission check failed'); };
      const filter = CrudAuthWithPermissionsFilter(throwingPermissionFunc);
      
      expect(() => filter.filter(regularUser)).toThrow('Permission check failed');
    });
  });
});