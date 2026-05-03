import { Injectable } from '@nestjs/common';

const serverStartTime = new Date();

@Injectable()
export class AppService {
  getHello(): string {
    return `Hello World! Server started at ${serverStartTime.toISOString()}`;
  }
}
