import { validate } from 'class-validator';
import { IsNotBlobFile } from '../is-not-blob-file';

class TestEntity {
    @IsNotBlobFile() fileData: any;
}

const validateFile = (fileData: any) => {
    const entity = new TestEntity();
    entity.fileData = fileData;
    return validate(entity);
};

describe('IsNotBlobFile', () => {
    it('rejects a blob: src', async () => {
        const errors = await validateFile({ src: 'blob:https://app/123', title: 'a.pdf' });
        expect(errors).toHaveLength(1);
        expect(errors[0].constraints.IsNotBlobFile).toBeDefined();
    });

    it('accepts a data URL src', async () => {
        expect(await validateFile({ src: 'data:application/pdf;base64,JVBERi0=', title: 'a.pdf' })).toHaveLength(0);
    });

    it('accepts empty values', async () => {
        expect(await validateFile(undefined)).toHaveLength(0);
        expect(await validateFile(null)).toHaveLength(0);
        expect(await validateFile({ title: 'a.pdf' })).toHaveLength(0);
    });
});
