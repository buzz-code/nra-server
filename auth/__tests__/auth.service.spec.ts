import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as cookie from 'cookie';
import { User } from '@shared/entities/User.entity';
import { getCurrentHebrewYear } from '@shared/utils/entity/year.util';
import { USER_INITIALIZATION_SERVICE } from '../user-initialization.interface';

describe('AuthService', () => {
    let service: AuthService;
    let userRepository: Repository<User>;
    let jwtService: JwtService;
    let userInitService: any;

    beforeEach(async () => {
        userInitService = {
            initializeUserData: jest.fn().mockResolvedValue(undefined)
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: JwtService,
                    useValue: {
                        sign: jest.fn(),
                    },
                },
                {
                    provide: getRepositoryToken(User),
                    useValue: {
                        findOne: jest.fn(),
                        findOneBy: jest.fn(),
                        create: jest.fn(),
                        save: jest.fn(),
                        update: jest.fn(),
                        manager: {
                            getRepository: jest.fn(() => userRepository),
                        }
                    },
                },
                {
                    provide: USER_INITIALIZATION_SERVICE,
                    useValue: userInitService
                }
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        userRepository = module.get<Repository<User>>(getRepositoryToken(User));
        jwtService = module.get<JwtService>(JwtService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateUser', () => {
        it('should return the user if the username and password match', async () => {
            const username = 'test@example.com';
            const pass = 'password';
            const userStub = {
                email: 'test@example.com',
                password: 'password',
                id: 1,
                isAdmin: false,
            } as any as User;

            const findOneMock = jest.spyOn(userRepository, 'findOne').mockResolvedValue(userStub);
            const compareMock = jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

            const result = await service.validateUser(username, pass);

            expect(result).toEqual({ ...userStub, password: undefined });
            expect(findOneMock).toHaveBeenCalledWith({ where: { email: username } });
            expect(compareMock).toHaveBeenCalledWith(pass, userStub.password);
        });

        it('should return null if the user does not exist', async () => {
            const username = 'test@example.com';
            const pass = 'password';

            const findOneMock = jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

            const result = await service.validateUser(username, pass);

            expect(result).toEqual(null);
            expect(findOneMock).toHaveBeenCalledWith({ where: { email: username } });
        });

        it('should return null if the username and password do not match', async () => {
            const username = 'test@example.com';
            const pass = 'password';

            const userStub = {
                email: 'test@example.com',
                password: 'oldPassword',
                id: 1,
                isAdmin: false,
            } as any as User;

            const findOneMock = jest.spyOn(userRepository, 'findOne').mockResolvedValue(userStub);
            const compareMock = jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

            const result = await service.validateUser(username, pass);

            expect(result).toBeNull();
            expect(findOneMock).toHaveBeenCalledWith({ where: { email: username } });
            expect(compareMock).toHaveBeenCalledWith(pass, userStub.password);
        });

        it('should allow admin users to login', async () => {
            const username = 'admin@example.com';
            const pass = 'password';

            process.env.ADMIN_USER = `${username}:${pass}`;

            const result = await service.validateUser(username, pass);

            expect(result.id).toEqual(-1);
            expect(result.permissions?.admin).toEqual(true);
            expect(result.name).toEqual('admin');
        });
    });

    describe('registerUser', () => {
        it('should create a new user if the email is unique and initialize user data', async () => {
            const username = 'test@example.com';
            const pass = 'password';

            const userToCreate = {
                name: 'test',
                email: username,
                password: pass,
                permissions: {},
                userInfo: {
                    organizationName: 'test',
                },
            } as any as User;

            const findOneMock = jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
            const createMock = jest.spyOn(userRepository, 'create').mockReturnValue(userToCreate);
            const saveMock = jest.spyOn(userRepository, 'save').mockImplementation(() => Promise.resolve(userToCreate));

            const result = await service.registerUser(username, pass, userToCreate.userInfo);

            expect(createMock).toHaveBeenCalledWith(userToCreate);
            expect(saveMock).toHaveBeenCalledWith(userToCreate);
            expect(userInitService.initializeUserData).toHaveBeenCalledWith(userToCreate);
            expect(result).toEqual({ ...userToCreate, password: undefined });
        });

        it('should throw an UnauthorizedException if the email is not unique', async () => {
            const username = 'test@example.com';
            const pass = 'password';

            const userToCreate = {
                name: 'test',
                email: username,
                password: pass,
                permissions: {},
                userInfo: {},
            } as any as User;

            const findOneMock = jest.spyOn(userRepository, 'findOne').mockResolvedValue(userToCreate);

            await expect(service.registerUser(username, pass, { name: 'test' })).rejects.toThrow(UnauthorizedException);
            expect(findOneMock).toHaveBeenCalledWith({ where: { email: username } });
        });

        it('should create a user with userInfo', async () => {
            const username = 'test@example.com';
            const pass = 'password';

            const userToCreate = {
                name: username,
                email: username,
                password: pass,
                permissions: {},
                userInfo: null,
            } as any as User;

            const createMock = jest.spyOn(userRepository, 'create').mockReturnValue(userToCreate);
            const saveMock = jest.spyOn(userRepository, 'save').mockImplementation(() => Promise.resolve(userToCreate));

            const result = await service.registerUser(username, pass, userToCreate.userInfo);

            expect(createMock).toHaveBeenCalledWith(userToCreate);
            expect(saveMock).toHaveBeenCalledWith(userToCreate);
            expect(result).toEqual({ ...userToCreate, password: undefined });
        });
    });

    describe('getCookieWithJwtToken', () => {
        it('should generate a valid JWT token for the provided user object', async () => {
            const user = {
                id: 1,
                email: 'test@example.com',
                name: 'test',
                permissions: null,
            }

            const result = await service.getCookieWithJwtToken(user);

            expect(jwtService.sign).toHaveBeenCalledWith({ username: user.email, id: user.id, name: user.name, permissions: {} });
        });

        it('should generate token for user with permissions', async () => {
            const user = {
                id: 1,
                email: 'test@example.com',
                name: 'test',
                permissions: {
                    admin: true,
                },
            }

            const result = await service.getCookieWithJwtToken(user);

            expect(jwtService.sign).toHaveBeenCalledWith({ username: user.email, id: user.id, name: user.name, permissions: user.permissions });
        });
    });

    describe('getCookieForLogOut', () => {
        it('should generate a logout cookie if the user is not impersonating', async () => {
            const serializeMock = jest.spyOn(cookie, 'serialize');

            await service.getCookieForLogOut();

            expect(serializeMock).toHaveBeenCalledWith('Authentication', '', {
                httpOnly: true,
                path: '/',
                maxAge: 0,
                sameSite: true,
            });
        });

        it('should generate a JWT token for the admin user and return it as a logout cookie if the user is impersonating', async () => {
            const getCookieMock = jest.spyOn(service, 'getCookieWithJwtToken');

            const user = {
                impersonated: true,
            } as any as User;

            await service.getCookieForLogOut(user);

            expect(getCookieMock).toHaveBeenCalled();
        });
    });

    describe('getCookieForImpersonate', () => {
        it('should generate a valid JWT token for the impersonated user and return it as a cookie', async () => {
            const userId = 1;
            const userStub = {
                id: userId,
                email: 'test@example.com',
                name: 'test',
                permissions: {},
                impersonated: true,
            } as any as User;


            const getCookieMock = jest.spyOn(service, 'getCookieWithJwtToken');
            const findOneByMock = jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(userStub);

            await service.getCookieForImpersonate(userId);

            expect(findOneByMock).toHaveBeenCalledWith({ id: userId });
            expect(getCookieMock).toHaveBeenCalledWith({
                id: userId,
                email: 'test@example.com',
                name: 'test',
                permissions: {},
                impersonated: true,
            });
        });
    });

    describe('User data initialization', () => {
        it('should call the userInitService when registering a new user', async () => {
            const username = 'test@example.com';
            const pass = 'password';

            const userToCreate = {
                name: 'test',
                email: username,
                password: pass,
                permissions: {},
                userInfo: {
                    organizationName: 'test',
                },
                id: 1
            } as any as User;

            jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);
            jest.spyOn(userRepository, 'create').mockReturnValue(userToCreate);
            jest.spyOn(userRepository, 'save').mockImplementation(() => Promise.resolve(userToCreate));

            await service.registerUser(username, pass, userToCreate.userInfo);

            expect(userInitService.initializeUserData).toHaveBeenCalledWith(userToCreate);
        });

        it('should handle case when userInitService is not provided', async () => {
            // Create separate repository mocks for this test
            const localUserRepository = {
                findOne: jest.fn(),
                findOneBy: jest.fn(),
                create: jest.fn(),
                save: jest.fn(),
                update: jest.fn(),
                manager: {
                    getRepository: jest.fn(),
                }
            };

            // Create a new instance of AuthService without the userInitService
            const moduleWithoutInit: TestingModule = await Test.createTestingModule({
                providers: [
                    AuthService,
                    {
                        provide: JwtService,
                        useValue: {
                            sign: jest.fn(),
                        },
                    },
                    {
                        provide: getRepositoryToken(User),
                        useValue: localUserRepository,
                    }
                ],
            }).compile();

            const serviceWithoutInit = moduleWithoutInit.get<AuthService>(AuthService);

            const username = 'test@example.com';
            const pass = 'password';

            const userToCreate = {
                name: 'test',
                email: username,
                password: pass,
                permissions: {},
                userInfo: {
                    organizationName: 'test',
                },
            } as any as User;

            // Set up proper mock behavior for this test
            localUserRepository.findOne.mockResolvedValue(null);
            localUserRepository.save.mockResolvedValue(userToCreate);

            await serviceWithoutInit.registerUser(username, pass, userToCreate.userInfo);
            expect(localUserRepository.create).toHaveBeenCalledWith(userToCreate);
            expect(userInitService.initializeUserData).not.toHaveBeenCalled();
            expect(localUserRepository.findOne).toHaveBeenCalledWith({ where: { email: username } });
        });
    });

    describe('getProfile', () => {
        it('should return the user profile', async () => {
            const userId = 1;
            const userStub = {
                id: userId,
                email: 'test@example.com',
                name: 'test',
                permissions: {},
            } as any as User;

            const findOneByMock = jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(userStub);

            const result = await service.getProfile(userId);

            expect(findOneByMock).toHaveBeenCalledWith({ id: userId });
            expect(result).toEqual(userStub);
        });

        it('should throw an error if the user is not found', async () => {
            const userId = 1;

            jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(null);

            await expect(service.getProfile(userId)).rejects.toThrowError('User not found');
        });
    });

    describe('updateSettings', () => {
        it('should update the user settings', async () => {
            const userId = 1;
            const userStub = {
                id: userId,
                email: 'test@example.com',
                name: 'test',
                permissions: {},
                additionalData: { pageSize: 5, theme: 'light' },
            } as any as User;

            const findOneByMock = jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(userStub);
            const updateMock = jest.spyOn(userRepository, 'update').mockResolvedValue(null);

            const result = await service.updateSettings(userId, { pageSize: 10 });

            expect(findOneByMock).toHaveBeenCalledWith({ id: userId });
            expect(updateMock).toHaveBeenCalledWith(userId, { additionalData: { pageSize: 10, theme: 'light' } });
            expect(result).toEqual({ success: true });
        });

        it('should throw an error if the user is not found', async () => {
            const userId = 1;

            jest.spyOn(userRepository, 'findOneBy').mockResolvedValue(null);

            await expect(service.updateSettings(userId, { name: 'new name' })).rejects.toThrowError('User not found');
        });
    });
});