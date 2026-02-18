export const permissionKeys = {
    admin: 'admin',
    manager: 'manager',
    showUsersData: 'showUsersData',
    editPagesData: 'editPagesData',
    editPaymentTracksData: 'editPaymentTracksData',
    genericImageUpload: 'genericImageUpload',
    phoneCampaign: 'phoneCampaign',
};

/**
 * Checks if the auth object has the specified permission key.
 * Supports nested keys separated by dots (e.g., 'inLessonReport.withLate').
 * Assumes auth.permissions is an object.
 * @param auth - The auth object (e.g., req.auth)
 * @param key - The permission key to check, can be nested
 * @returns true if the permission is present, false otherwise
 */
export function hasPermission(auth: any, key: string): boolean {
    const keys = key.split('.');
    let current = auth?.permissions;
    for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
            current = current[k];
        } else {
            return false;
        }
    }
    return Boolean(current);
}

/**
 * Checks if the auth object has admin permission.
 * @param auth - The auth object (e.g., req.auth)
 * @returns true if admin permission is present, false otherwise
 */
export function isAdmin(auth: any): boolean {
    return hasPermission(auth, permissionKeys.admin);
}
