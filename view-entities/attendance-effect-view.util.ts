import { DataSource } from "typeorm";

type EntityType = Function | string;

export interface IUser {
  id: number;
}

export interface IGradeEffectByUser {
  id: string;
  userId: number;
  number: number;
  effect: number;
}

export interface IAbsCountEffectByUser {
  id: string;
  userId: number;
  number: number;
  effect: number;
}

/**
 * Creates SQL expression for GradeEffectByUser view
 * @param dataSource TypeORM DataSource
 * @param UserEntity The User entity class
 * @returns QueryBuilder expression for the view
 */
export function createGradeEffectByUserExpression(dataSource: DataSource, UserEntity: EntityType, AttGradeEffectEntity: EntityType) {
  return dataSource
    .createQueryBuilder()
    .select('CONCAT(users.id, "_", numbers.number)', 'id')
    .addSelect('users.id', 'userId')
    .addSelect('numbers.number', 'number')
    .addSelect('MAX(att_grade_effect.effect)', 'effect')
    .from('numbers', 'numbers')
    .leftJoin(UserEntity, 'users', '1 = 1')
    .leftJoin(AttGradeEffectEntity, 'att_grade_effect', 'att_grade_effect.user_id = users.id AND att_grade_effect.percents <= numbers.number')
    .groupBy('users.id')
    .addGroupBy('numbers.number')
    .orderBy('users.id')
    .addOrderBy('numbers.number');
}

/**
 * Creates SQL expression for AbsCountEffectByUser view
 * @param dataSource TypeORM DataSource
 * @param UserEntity The User entity class
 * @returns QueryBuilder expression for the view
 */
export function createAbsCountEffectByUserExpression(dataSource: DataSource, UserEntity: EntityType, AttGradeEffectEntity: EntityType) {
  return dataSource
    .createQueryBuilder()
    .select('CONCAT(users.id, "_", numbers.number)', 'id')
    .addSelect('users.id', 'userId')
    .addSelect('numbers.number', 'number')
    .addSelect('MIN(att_grade_effect.effect)', 'effect')
    .from('numbers', 'numbers')
    .leftJoin(UserEntity, 'users', '1 = 1')
    .leftJoin(AttGradeEffectEntity, 'att_grade_effect', 'att_grade_effect.user_id = users.id AND att_grade_effect.count <= numbers.number')
    .groupBy('users.id')
    .addGroupBy('numbers.number')
    .orderBy('users.id')
    .addOrderBy('numbers.number');
}