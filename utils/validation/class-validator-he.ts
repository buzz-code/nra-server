import {
    ValidationOptions,
    IsNotEmpty as _IsNotEmpty,
    MaxLength as _MaxLength,
    IsNumber as _IsNumber,
    IsInt as _IsInt,
    IsNumberOptions,
    ValidationArguments,
} from "class-validator";
import { IsUniqueCombination as _IsUniqueCombination } from "./is-unique-combination";
import { GetMaxLimitType, MaxCountByUserLimit as _MaxCountByUserLimit } from "./max-count-by-user-limit";

export const IsNotEmpty = (validationOptions?: ValidationOptions): PropertyDecorator =>
    _IsNotEmpty({ ...validationOptions, message: getErrorMessageFunction('הערך של $property לא יכול להיות ריק') });
export const MaxLength = (max: number, validationOptions?: ValidationOptions): PropertyDecorator =>
    _MaxLength(max, { ...validationOptions, message: getErrorMessageFunction('$property לא יכול להיות ארוך יותר מ-$constraint1 תווים') });
export const IsNumber = (options?: IsNumberOptions, validationOptions?: ValidationOptions): PropertyDecorator =>
    _IsNumber(options, { ...validationOptions, message: getErrorMessageFunction('$property חייב להיות מספר') });
export const IsInt = (validationOptions?: ValidationOptions): PropertyDecorator =>
    _IsInt({ ...validationOptions, message: getErrorMessageFunction('$property חייב להיות מספר שלם') });
export const IsUniqueCombination = (otherProperties: string[] = [], entities: Function[] = [], validationOptions?: ValidationOptions) =>
    _IsUniqueCombination(otherProperties, entities, { ...validationOptions, message: getErrorMessageFunction('קיימת כבר רשומה עם ערכים זהים למשתמש בשדות $constraint1') });
export const MaxCountByUserLimit = (entity: Function, getMaxLimit: GetMaxLimitType, entities: Function[] = [], foreignKey = 'id', validationOptions?: ValidationOptions) =>
    _MaxCountByUserLimit(entity, getMaxLimit, entities, foreignKey, { ...validationOptions, message: getErrorMessageFunction('לא ניתן ליצור עוד רשומות - הגבלת כמות לטבלת $constraint1') });

function getErrorMessageFunction(message: string) {
    return function (validationArguments: ValidationArguments) {
        if (!validationArguments.constraints) {
            return null;
        }
        const translatedConstraints = validationArguments.constraints.map((constraint) => getTranslatedConstraint(constraint));
        const translatedProperty = getTranslatedProperty(validationArguments.property);
        return message
            .replace(/\$constraint(\d+)/g, (match, constraintIndex) => translatedConstraints[parseInt(constraintIndex) - 1])
            .replace(/\$property/g, translatedProperty);
    }
}

function getTranslatedConstraint(constraint: any) {
    if (constraint === 'StudentByYear') {
        return 'שיוך תלמידות';
    }
    return getTranslatedProperty(constraint);
}

const translationDict = {
    entityId: 'מזהה ישות',
    entityName: 'שם ישות',
    operation: 'פעולה',
    src: 'קישור',
    title: 'כותרת',
    fileData: 'קובץ',
    imageTarget: 'יעד',
    fileName: 'שם קובץ',
    fileSource: 'מקור קובץ',
    response: 'תגובה',
    alias: 'כינוי',
    entity: 'ישות',
    description: 'תיאור',
    value: 'ערך',
    name: 'שם',
    monthlyPrice: 'מחיר חודשי',
    annualPrice: 'מחיר שנתי',
    studentNumberLimit: 'מספר תלמידות',
    from: 'מאת',
    to: 'אל',
    studentTz: 'תעודת זהות תלמידה',
    studentReferenceId: 'מזהה תלמידה',
    teacherId: 'תעודת זהות מורה',
    teacherReferenceId: 'מזהה מורה',
    klassId: 'מזהה כיתה',
    klassReferenceId: 'מזהה כיתה',
    lessonId: 'מזהה שיעור',
    lessonReferenceId: 'מזהה שיעור',
    reportDate: 'תאריך דיווח',
    key: 'מפתח',
    year: 'שנה',
    klassTypeId: 'מזהה סוג כיתה',
    klassTypeReferenceId: 'מזהה סוג כיתה',
    startDate: 'תאריך התחלה',
    endDate: 'תאריך סיום',
    tz: 'תעודת זהות',
    email: 'דוא"ל',
    phoneNumber: 'מספר טלפון',
    paymentMethod: 'אמצעי תשלום',
    mailAddressAlias: 'כתובת דוא"ל',
    mailAddressTitle: 'כותרת כתובת דוא"ל',
    comments: 'הערות',
    sheetName: 'שם גליון',
    absnceCount: 'מספר חיסורים',
    absnceCode: 'קוד חיסור',
    senderName: 'שם שולח',
    reason: 'סיבה',
    comment: 'הערה',
    isApproved: 'מאושר',
    klasses: 'כיתות',
    phone: 'טלפון',
    phone2: 'טלפון 2',
    howManyLessons: 'מספר שיעורים',
    absCount: 'מספר היעדרויות',
    approvedAbsCount: 'מספר היעדרויות מאושרות',
    grade: 'ציון',
};

function getTranslatedProperty(property: string) {
    return translationDict[property] || property;
}