export function getUserIdFromUser(user: any, realUser = false): number | undefined {
    if (!user) return undefined;
    if (user.permissions?.admin) return undefined;
    if (realUser) return user.id || undefined;
    return user.effective_id || user.id || undefined;
}
