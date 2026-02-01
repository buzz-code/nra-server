import { Injectable, CanActivate, ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_MAINTENANCE_KEY = 'skipMaintenance';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skipMaintenance = this.reflector.getAllAndOverride<boolean>(
      SKIP_MAINTENANCE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipMaintenance) {
      return true;
    }

    const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';

    if (!isMaintenanceMode) {
      return true;
    }

    const maintenanceMessage = process.env.MAINTENANCE_MESSAGE || 'המערכת במצב תחזוקה. אנא נסו שוב מאוחר יותר.';

    throw new ServiceUnavailableException({
      message: maintenanceMessage,
    });
  }
}
