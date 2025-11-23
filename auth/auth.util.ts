import { isAdmin } from '@shared/utils/permissionsUtil';

export function getUserIdFromUser(user: any, realUser = false): number | undefined {
    if (!user) return undefined;
    if (isAdmin(user)) return undefined;
    if (realUser) return user.id || undefined;
    return user.effective_id || user.id || undefined;
}
