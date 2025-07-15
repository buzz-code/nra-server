import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { databaseConfig } from "../database.config";

describe("databaseConfig", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
        jest.resetModules();
    });

    it("should be defined", () => {
        expect(databaseConfig).toBeDefined();
    });

    it("should use sqlite for test environment", async () => {
        process.env.NODE_ENV = 'test';
        jest.resetModules();

        const { databaseConfig: testConfig } = await import("../database.config");
        expect(testConfig.type).toBe('sqlite');
        expect(testConfig.database).toBe(':memory:');
    });

    describe("production configuration", () => {
        let originalEnv: string;
        let databaseConfig: DataSourceOptions;

        beforeAll(async () => {
            originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            jest.resetModules();
            databaseConfig = await import("../database.config").then(mod => mod.databaseConfig);
        });

        afterAll(() => {
            process.env.NODE_ENV = originalEnv;
            jest.resetModules();
        });

        it("should use mysql for production environment", async () => {
            process.env.NODE_ENV = 'production';
            jest.resetModules();

            const { databaseConfig: prodConfig } = await import("../database.config");
            expect(prodConfig.type).toBe('mysql');
        });

        it("should have cache provider", () => {
            const cacheProvider = (databaseConfig.cache as any)?.provider;
            expect(cacheProvider).toBeDefined();
            expect(typeof cacheProvider).toBe("function");
            expect(cacheProvider().constructor.name).toBe("KeyvCacheProvider");
        });
    });
});