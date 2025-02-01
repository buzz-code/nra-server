import { CrudAuthFilter, CrudAuthAdminFilter, CrudAuthWithPermissionsFilter, CrudAuthReadOnlyWithPermissionFunc } from '../crud-auth.filter';
import { getUserIdFromUser } from '../auth.util';

// Mock getUserIdFromUser since we don't want to test its implementation here
jest.mock('../auth.util', () => ({
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

  const userWithMultiplePermissions = {
    id: 456,
    permissions: { 
      admin: false,
      editor: true,
      viewer: true
    }
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

    it('should handle user with multiple permissions', () => {
      const result = CrudAuthFilter.filter(userWithMultiplePermissions);
      expect(getUserIdFromUser).toHaveBeenCalledWith(userWithMultiplePermissions);
      expect(result).toEqual({ userId: 123 });
    });

    it('should throw error for null user', () => {
      expect(() => CrudAuthFilter.filter(null)).toThrow();
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

    it('should return id: -1 for user with other permissions but not admin', () => {
      const result = CrudAuthAdminFilter.filter(userWithMultiplePermissions);
      expect(result).toEqual({ id: -1 });
    });

    it('should throw error for undefined user', () => {
      expect(() => CrudAuthAdminFilter.filter(undefined)).toThrow();
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

    it('should handle complex permission checks', () => {
      const complexPermissionFunc = (permissions) => permissions.editor && permissions.viewer;
      const filter = CrudAuthWithPermissionsFilter(complexPermissionFunc);
      const result = filter.filter(userWithMultiplePermissions);

      expect(result).toEqual({});
    });

    it('should handle async permission functions', async () => {
      const asyncPermissionFunc = jest.fn().mockResolvedValue(true);
      const filter = CrudAuthWithPermissionsFilter(asyncPermissionFunc);
      const result = filter.filter(regularUser);

      expect(result).toEqual({});
      expect(asyncPermissionFunc).toHaveBeenCalledWith(regularUser.permissions);
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

    it('should handle complex permission checks for read-only access', () => {
      const complexPermissionFunc = (permissions) => permissions.viewer && !permissions.editor;
      const filter = CrudAuthReadOnlyWithPermissionFunc(complexPermissionFunc);
      const result = filter.persist(userWithMultiplePermissions);

      expect(result).toEqual({ id: 'break' });
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

    it('should handle users with empty permissions object', () => {
      const userWithEmptyPermissions = { id: 1, permissions: {} };
      const result = CrudAuthFilter.filter(userWithEmptyPermissions);
      expect(result).toEqual({ userId: 123 });
    });

    it('should handle malformed user objects', () => {
      const malformedUser = { permissions: { admin: false } }; // missing id
      const result = CrudAuthFilter.filter(malformedUser);
      expect(result).toEqual({ userId: 123 });
    });

    it('should handle boolean permission values', () => {
      const userWithBooleanPermission = { 
        id: 1, 
        permissions: { admin: false, editor: true }
      };
      const permissionFunc = (permissions) => !!permissions.editor;
      const filter = CrudAuthWithPermissionsFilter(permissionFunc);
      const result = filter.filter(userWithBooleanPermission);
      expect(result).toEqual({});
    });

    it('should handle nested permission objects', () => {
      const userWithNestedPermissions = {
        id: 1,
        permissions: {
          admin: false,
          roles: {
            editor: {
              level: 'senior'
            }
          }
        }
      };
      const permissionFunc = (permissions) => permissions.roles?.editor?.level === 'senior';
      const filter = CrudAuthWithPermissionsFilter(permissionFunc);
      const result = filter.filter(userWithNestedPermissions);
      expect(result).toEqual({});
    });
  });
});