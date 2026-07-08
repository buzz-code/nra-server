import { BufferToAudioReportGenerator } from "../buffer-to-audio.generator";
import { CommonFileFormat } from "../types";

describe('BufferToAudioReportGenerator', () => {
    it('should use the file format passed to the constructor', () => {
        const mp3Generator = new BufferToAudioReportGenerator(() => 'test', CommonFileFormat.Mp3);
        const wavGenerator = new BufferToAudioReportGenerator(() => 'test', CommonFileFormat.Wav);

        expect(mp3Generator.fileFormat).toBe(CommonFileFormat.Mp3);
        expect(wavGenerator.fileFormat).toBe(CommonFileFormat.Wav);
    });

    it('should return the input buffer unchanged', async () => {
        const generator = new BufferToAudioReportGenerator(() => 'test', CommonFileFormat.Wav);
        const data = Buffer.from('fake-wav-bytes');

        const result = await generator.getFileBuffer(data);

        expect(result).toEqual(data);
    });
});
