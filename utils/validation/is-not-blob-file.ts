import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Rejects a file value whose `src` is a browser-local `blob:` URL.
 * Such a URL is valid only inside the uploading tab, so storing it loses the file.
 */
export function IsNotBlobFile(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'IsNotBlobFile',
            target: object.constructor,
            propertyName: propertyName,
            options: {
                message: 'הקובץ לא נקלט במלואו. נא לבחור את הקובץ שוב ולשמור',
                ...validationOptions,
            },
            validator: {
                validate(value: any) {
                    const src = value?.src;
                    return !(typeof src === 'string' && src.trim().startsWith('blob:'));
                },
            },
        });
    };
}
