import { generateCommonFileResponse, getFileExtension, getFileBuffer, getFileType } from '../report.util';
import { BaseReportGenerator } from '../report.generators';
import { DataSource } from 'typeorm';
import { CommonFileFormat } from '../types';

describe('report.util', () => {
    describe('generateCommonFileResponse', () => {
        // Mock BaseReportGenerator and DataSource
        const mockGenerator = {} as BaseReportGenerator;
        const mockParams = {};
        const mockDataSource = {} as DataSource;

        it('should return the expected response object', async () => {
            mockGenerator.getReportData = jest.fn().mockResolvedValue({});
            mockGenerator.getFileBuffer = jest.fn().mockResolvedValue(Buffer.from(''));
            mockGenerator.getReportName = jest.fn().mockReturnValue('report');

            const response = await generateCommonFileResponse(mockGenerator, mockParams, mockDataSource);

            expect(response).toHaveProperty('data');
            expect(response).toHaveProperty('type');
            expect(response).toHaveProperty('disposition');
        });
    });

    describe('getFileExtension', () => {
        it('should return the correct file extension', () => {
            expect(getFileExtension(CommonFileFormat.Pdf)).toBe('pdf');
            expect(getFileExtension(CommonFileFormat.Excel)).toBe('xlsx');
            expect(getFileExtension(CommonFileFormat.Json)).toBe('json');
            expect(getFileExtension(CommonFileFormat.Zip)).toBe('zip');
            expect(getFileExtension(CommonFileFormat.Html)).toBe('html');
        });
    });

    describe('getFileType', () => {
        it('should return the correct file type', () => {
            expect(getFileType(CommonFileFormat.Pdf)).toBe('application/pdf');
            expect(getFileType(CommonFileFormat.Excel)).toBe('application/vnd.ms-excel');
            expect(getFileType(CommonFileFormat.Json)).toBe('application/json');
            expect(getFileType(CommonFileFormat.Zip)).toBe('application/zip');
            expect(getFileType(CommonFileFormat.Html)).toBe('text/html');
        })
    });

    describe('getFileBuffer', () => {
        it('should call generator.getFileBuffer with the provided data', async () => {
            const mockGenerator = {
                getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('')),
            } as any as BaseReportGenerator;
            const mockData = {};

            await getFileBuffer(mockGenerator, mockData);

            expect(mockGenerator.getFileBuffer).toHaveBeenCalledWith(mockData);
        });

        it('should throw an error if generator.getFileBuffer throws an error', async () => {
            const mockGenerator = {
                getFileBuffer: jest.fn().mockRejectedValue(new Error('Test error')),
            } as any as BaseReportGenerator;
            const mockData = {};

            await expect(getFileBuffer(mockGenerator, mockData)).rejects.toThrowError('Test error');
        });
    });
});
