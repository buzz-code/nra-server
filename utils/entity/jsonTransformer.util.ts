import { ValueTransformer } from "typeorm";

export default class JsonTransformer<T = any> implements ValueTransformer {
    to(obj: T): string {
        return JSON.stringify(obj);
    }

    from(raw: string): T {
        return JSON.parse(raw);
    }
}
