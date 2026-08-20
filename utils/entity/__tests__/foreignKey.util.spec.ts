jest.mock('@shared/config/database.config', () => ({
    databaseConfig: {
        type: 'sqlite',
        database: ':memory:',
    }
}));

import { DataSource } from 'typeorm';
import * as foreignKeyUtil from '../foreignKey.util';
import { databaseConfig } from '@shared/config/database.config';

describe('foreignKeyUtil', () => {
    it('should be defined', () => {
        expect(foreignKeyUtil).toBeDefined();
    });

    describe('getDataSource', () => {
        it('should return dataSource', async () => {
            const dataSource = await foreignKeyUtil.getDataSource([]);
            expect(dataSource).toBeDefined();
            dataSource.destroy();
        });
    });

    describe('findOneAndAssignReferenceId', () => {
        let dataSource: DataSource;

        beforeEach(async () => {
            dataSource = new DataSource(databaseConfig);
            dataSource.getRepository = jest.fn().mockReturnValue({
                findOne: jest.fn()
            });
            await dataSource.initialize();
        });

        afterEach(() => {
            dataSource?.destroy();
        });

        it('should return referenceIdValue if keyValue is not defined', async () => {
            const referenceIdValue = 1;
            const repository = {} as any;
            const result = await foreignKeyUtil
                .findOneAndAssignReferenceId(
                    dataSource, repository, {}, 1, referenceIdValue, undefined
                );
            expect(result).toEqual(referenceIdValue);
        });

        it('should return referenceIdValue if referenceIdValue is defined', async () => {
            const referenceIdValue = 1;
            const repository = {} as any;
            const result = await foreignKeyUtil
                .findOneAndAssignReferenceId(
                    dataSource, repository, {}, 1, referenceIdValue, 1
                );
            expect(result).toEqual(referenceIdValue);
        });

        it('should return items id if keyValue is defined and referenceIdValue is not defined', async () => {
            const referenceIdValue = undefined;
            const repository = {} as any;
            const findSpy = jest
                .spyOn(dataSource.getRepository(repository), 'findOne')
                .mockResolvedValue({ id: 1 });
            const result = await foreignKeyUtil
                .findOneAndAssignReferenceId(
                    dataSource, repository, {}, 1, referenceIdValue, 1
                );
            expect(result).toEqual(1);
            expect(findSpy).toHaveBeenCalledWith({ where: { userId: 1 } });
        });

        it('should set default value to where if not defined', async () => {
            const referenceIdValue = undefined;
            const repository = {} as any;
            const findSpy = jest
                .spyOn(dataSource.getRepository(repository), 'findOne')
                .mockResolvedValue({ id: 1 });
            const result = await foreignKeyUtil
                .findOneAndAssignReferenceId(
                    dataSource, repository, undefined, 1, referenceIdValue, 1
                );
            expect(result).toEqual(1);
            expect(findSpy).toHaveBeenCalledWith({ where: { userId: 1 } });
        });

        it('should return void 0 if not found', async () => {
            const referenceIdValue = undefined;
            const repository = {} as any;
            const findSpy = jest
                .spyOn(dataSource.getRepository(repository), 'findOne')
                .mockResolvedValue(null);
            const result = await foreignKeyUtil
                .findOneAndAssignReferenceId(
                    dataSource, repository, {}, 1, referenceIdValue, 1
                );
            expect(result).toEqual(undefined);
            expect(findSpy).toHaveBeenCalledWith({ where: { userId: 1 } });
        });
    });

    describe('findOneAndAssignKey', () => {
        let dataSource: DataSource;

        beforeEach(async () => {
            dataSource = new DataSource(databaseConfig);
            dataSource.getRepository = jest.fn().mockReturnValue({
                findOne: jest.fn()
            });
            await dataSource.initialize();
        });

        afterEach(() => {
            dataSource?.destroy();
        });

        it('should return keyValue if referenceIdValue is not defined', async () => {
            const keyValue = 1;
            const repository = {} as any;
            const result = await foreignKeyUtil
                .findOneAndAssignKey(
                    dataSource, repository, 1, undefined, keyValue
                );
            expect(result).toEqual(keyValue);
        });

        it('should return the found item\'s key field when referenceIdValue is defined', async () => {
            const repository = {} as any;
            const findSpy = jest
                .spyOn(dataSource.getRepository(repository), 'findOne')
                .mockResolvedValue({ id: 5, key: 42 });
            const result = await foreignKeyUtil
                .findOneAndAssignKey(
                    dataSource, repository, 1, 5, undefined
                );
            expect(result).toEqual(42);
            expect(findSpy).toHaveBeenCalledWith({ where: { id: 5, userId: 1 } });
        });

        it('should use a custom keyField when provided', async () => {
            const repository = {} as any;
            jest
                .spyOn(dataSource.getRepository(repository), 'findOne')
                .mockResolvedValue({ id: 5, code: 'ABC' });
            const result = await foreignKeyUtil
                .findOneAndAssignKey(
                    dataSource, repository, 1, 5, undefined, 'code'
                );
            expect(result).toEqual('ABC');
        });

        it('should fall back to the existing keyValue if the row no longer resolves', async () => {
            const repository = {} as any;
            jest
                .spyOn(dataSource.getRepository(repository), 'findOne')
                .mockResolvedValue(null);
            const result = await foreignKeyUtil
                .findOneAndAssignKey(
                    dataSource, repository, 1, 5, 9
                );
            expect(result).toEqual(9);
        });
    });

    describe('findManyAndAssignReferenceIds', () => {
        let dataSource: DataSource;

        beforeEach(async () => {
            dataSource = new DataSource(databaseConfig);
            dataSource.getRepository = jest.fn().mockReturnValue({
                find: jest.fn()
            });
            await dataSource.initialize();
        });

        afterEach(() => {
            dataSource?.destroy();
        });

        it('should return referenceIdValue if keyValue is not defined', async () => {
            const referenceIdValue = [1];
            const repository = {} as any;
            const result = await foreignKeyUtil
                .findManyAndAssignReferenceIds(
                    dataSource, repository, {}, 1, referenceIdValue, undefined
                );
            expect(result).toEqual(referenceIdValue);
        });

        it('should return referenceIdValue if referenceIdValue is defined', async () => {
            const referenceIdValue = [1];
            const repository = {} as any;
            const result = await foreignKeyUtil
                .findManyAndAssignReferenceIds(
                    dataSource, repository, {}, 1, referenceIdValue, [1]
                );
            expect(result).toEqual(referenceIdValue);
        });

        it('should return items id if keyValue is defined and referenceIdValue is not defined', async () => {
            const referenceIdValue = undefined;
            const repository = {} as any;
            const findSpy = jest
                .spyOn(dataSource.getRepository(repository), 'find')
                .mockResolvedValue([{ id: 1 }]);
            const result = await foreignKeyUtil
                .findManyAndAssignReferenceIds(
                    dataSource, repository, {}, 1, referenceIdValue, [1]
                );
            expect(result).toEqual([1]);
            expect(findSpy).toHaveBeenCalledWith({ where: { userId: 1 } });
        });

        it('should set default value to where if not defined', async () => {
            const referenceIdValue = undefined;
            const repository = {} as any;
            const findSpy = jest
                .spyOn(dataSource.getRepository(repository), 'find')
                .mockResolvedValue([{ id: 1 }]);
            const result = await foreignKeyUtil
                .findManyAndAssignReferenceIds(
                    dataSource, repository, undefined, 1, referenceIdValue, [1]
                );
            expect(result).toEqual([1]);
            expect(findSpy).toHaveBeenCalledWith({ where: { userId: 1 } });
        });
    });
});