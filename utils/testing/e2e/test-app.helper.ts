import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Helper class for setting up and tearing down the NestJS application in e2e tests
 */
export class TestAppHelper {
  private app: INestApplication;
  private moduleFixture: TestingModule;
  private dataSource: DataSource;

  /**
   * Initialize the test application
   */
  async initializeApp(): Promise<INestApplication> {
    this.moduleFixture = await Test.createTestingModule({
      imports: [this.AppModule],
    }).compile();

    this.app = this.moduleFixture.createNestApplication();
    await this.app.init();

    this.dataSource = this.moduleFixture.get<DataSource>(DataSource);

    return this.app;
  }

  constructor(private readonly AppModule: any) { }

  /**
   * Get the initialized application instance
   */
  getApp(): INestApplication {
    if (!this.app) {
      throw new Error('Application not initialized. Call initializeApp() first.');
    }
    return this.app;
  }

  /**
   * Get the HTTP server from the application
   */
  getHttpServer() {
    return this.getApp().getHttpServer();
  }

  /**
   * Get a service from the module
   */
  getService<T>(token: any): T {
    if (!this.moduleFixture) {
      throw new Error('Module fixture not available. Call initializeApp() first.');
    }
    return this.moduleFixture.get<T>(token);
  }

  /**
   * Get the DataSource
   */
  getDataSource(): DataSource {
    return this.dataSource;
  }

  /**
   * Clean up and close the application
   */
  async cleanup(): Promise<void> {
    try {
      if (this.app) {
        if (this.dataSource && this.dataSource.isInitialized) {
          await this.dataSource.destroy();
        }
        await this.app.close();
      }
      if (this.moduleFixture) {
        await this.moduleFixture.close();
      }
    } catch (error) {
      console.warn('Error during test cleanup:', error);
    }
  }
}

/**
 * Create and return a new TestAppHelper instance
 */
export function createTestApp(AppModule: any): TestAppHelper {
  return new TestAppHelper(AppModule);
}
