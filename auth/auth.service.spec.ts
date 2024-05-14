// import { Test, TestingModule } from '@nestjs/testing';
// import { AuthService } from './auth.service';
// import { getRepositoryToken } from '@nestjs/typeorm';
// import { User } from '@shared/entities/User.entity';
// import { JwtService } from '@nestjs/jwt';
// import { Repository } from 'typeorm';

// describe('AuthService', () => {
//   let service: AuthService;
//   let repository: Repository<User>;

//   beforeEach(async () => {
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         AuthService,
//         { provide: getRepositoryToken(User), useValue: {} },
//         JwtService,
//       ],
//     }).compile();

//     service = module.get<AuthService>(AuthService);
//     repository = module.get<Repository<User>>(getRepositoryToken(User));
//   });

//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });

//   describe('should validate user', () => {
//     it('should accept admin credentials', async () => {
//       const username = 'admin', password = 'adminPass'
//       process.env.ADMIN_USER = `${username}:${password}`
//       const user = await service.validateUser(username, password);
//       expect(user).toBeDefined();
//     });

//     it('should accept user credentials', async () => {
//       const username = 'user', password = 'password';
//       const mockUser = {}
//       const findOneMock = jest.spyOn(repository, 'findOne').mockResolvedValue({} as User);
//       const user = await service.validateUser(username, password);
//       expect(findOneMock).toBeCalledWith({ where: { email: 'user' } });
//       expect(user).toBeDefined();
//   })
// });
