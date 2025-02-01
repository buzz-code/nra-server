import { KeyvCacheProvider } from "typeorm-cache";
import { databaseConfig } from "../database.config";

describe("databaseConfig", () => {
    it("should be defined", () => {
        expect(databaseConfig).toBeDefined();
    });

    it("should have cache provider", () => {
        const cacheProvider = (databaseConfig.cache as any)?.provider;
        expect(cacheProvider).toBeDefined();
        expect(typeof cacheProvider).toBe("function");
        expect(cacheProvider()).toBeInstanceOf(KeyvCacheProvider);
    });
});