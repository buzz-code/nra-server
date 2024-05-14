export function getUserIdFromUser(user: any) {
    if (!user) return undefined;
    if (user.permissions?.admin) return undefined;
    return user.effective_id || user.id || undefined;
}
