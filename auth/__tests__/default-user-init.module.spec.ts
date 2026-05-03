import { Test, TestingModule } from '@nestjs/testing';
import { DefaultUserInitializationService, DefaultUserInitModule } from '../default-user-init.module';
import { USER_INITIALIZATION_SERVICE } from '../user-initialization.interface';

describe('DefaultUserInitModule', () => {
  let service: DefaultUserInitializationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DefaultUserInitModule],
    }).compile();

    service = module.get<DefaultUserInitializationService>(DefaultUserInitializationService);
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  it('initializeUserData resolves without throwing', async () => {
    await expect(service.initializeUserData({} as any)).resolves.toBeUndefined();
  });

  it('USER_INITIALIZATION_SERVICE token is provided', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DefaultUserInitModule],
    }).compile();

    const tokenService = module.get(USER_INITIALIZATION_SERVICE);
    expect(tokenService).toBeDefined();
  });
});
