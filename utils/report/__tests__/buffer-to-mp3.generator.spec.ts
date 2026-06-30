import { BufferToMp3ReportGenerator } from "../buffer-to-mp3.generator";
import { CommonFileFormat } from "../types";

const generator = new BufferToMp3ReportGenerator(() => 'test');

describe('BufferToMp3ReportGenerator', () => {
    it('should have Mp3 as its file format', () => {
        expect(generator.fileFormat).toBe(CommonFileFormat.Mp3);
    });

    it('should return the input buffer unchanged', async () => {
        const data = Buffer.from('fake-mp3-bytes');

        const result = await generator.getFileBuffer(data);

        expect(result).toEqual(data);
    });
});
