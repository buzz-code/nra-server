import { In, Repository } from "typeorm";

interface IHasReferenceFields {
    id: number;
    fillFields(): Promise<void>;
    [key: string]: any;
}

export async function fixReferences(
    repository: Repository<IHasReferenceFields>,
    ids: IHasReferenceFields['id'][],
    referenceFields: Record<string, string>,
) {
    const data = await repository.findBy({ id: In(ids) });
    for (const item of data) {
        for (const [field, referenceField] of Object.entries(referenceFields)) {
            if (item[field]) {
                item[referenceField] = null;
            }
        }
        await item.fillFields();
    }
    await repository.save(data);

    return `תוקנו ${data.length} רשומות`;
}
