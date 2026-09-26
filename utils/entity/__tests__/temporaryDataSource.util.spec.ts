import { DataSource } from 'typeorm';
import { withTemporaryDataSource } from '../temporaryDataSource.util';
import * as foreignKeyUtil from '../foreignKey.util';

jest.mock('../foreignKey.util', () => ({
    getDataSource: jest.fn(),
}));

describe('withTemporaryDataSource', () => {
    let dataSource: Partial<DataSource>;
    let destroySpy: jest.Mock;

    beforeEach(() => {
        destroySpy = jest.fn().mockResolvedValue(undefined);
        dataSource = { destroy: destroySpy };
        (foreignKeyUtil.getDataSource as jest.Mock).mockClear().mockResolvedValue(dataSource);
    });

    it('opens a data source scoped to the given entities and returns fn\'s result', async () => {
        const Entity = jest.fn();
        const result = await withTemporaryDataSource([Entity], async (ds) => {
            expect(ds).toBe(dataSource);
            return 'ok';
        });

        expect(foreignKeyUtil.getDataSource).toHaveBeenCalledWith([Entity]);
        expect(result).toBe('ok');
    });

    it('destroys the data source after fn resolves', async () => {
        await withTemporaryDataSource([], async () => 1);

        expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it('destroys the data source even when fn throws, and rethrows', async () => {
        const error = new Error('boom');

        await expect(
            withTemporaryDataSource([], async () => { throw error; })
        ).rejects.toBe(error);

        expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it('does not attempt to destroy anything if getDataSource itself fails', async () => {
        const error = new Error('cannot connect');
        (foreignKeyUtil.getDataSource as jest.Mock).mockRejectedValue(error);

        await expect(
            withTemporaryDataSource([], async () => 1)
        ).rejects.toBe(error);

        expect(destroySpy).not.toHaveBeenCalled();
    });
});
