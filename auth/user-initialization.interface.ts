import { User } from '@shared/entities/User.entity';

export interface IUserInitializationService {
  initializeUserData(user: User): Promise<void>;
}

export const USER_INITIALIZATION_SERVICE = 'USER_INITIALIZATION_SERVICE';