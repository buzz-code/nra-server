import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

/**
 * Common HTTP test utilities for e2e tests
 */
export class HttpTestUtils {
  constructor(private app: INestApplication) {}

  get(path: string) {
    return request(this.app.getHttpServer()).get(path);
  }

  post(path: string, data?: any) {
    const req = request(this.app.getHttpServer()).post(path);
    if (data) {
      req.send(data);
    }
    return req;
  }

  put(path: string, data?: any) {
    const req = request(this.app.getHttpServer()).put(path);
    if (data) {
      req.send(data);
    }
    return req;
  }

  delete(path: string) {
    return request(this.app.getHttpServer()).delete(path);
  }

  patch(path: string, data?: any) {
    const req = request(this.app.getHttpServer()).patch(path);
    if (data) {
      req.send(data);
    }
    return req;
  }
}
