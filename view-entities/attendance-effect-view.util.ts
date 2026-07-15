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
  effectPercent: number;
}

export interface IAbsCountEffectByUser {
  id: string;
  userId: number;
  number: number;
  effect: number;
  effectPercent: number;
}

// COALESCE(..., '') keeps the packed string non-null whenever the threshold matches, even if
// valueColumn itself is null (e.g. a row using effectPercent has a null effect, and vice versa) -
// otherwise MAX() would skip the correct winning row for whichever column happens to be null on it.
function createEffectExpressionByThreshold(thresholdColumn: string, valueColumn: string): string {
  return `
    CAST(
      COALESCE(
        SUBSTRING_INDEX(
          MAX(
            CASE WHEN att_grade_effect.${thresholdColumn} <= numbers.number
            /* Force utf8mb4_bin collation to avoid "Illegal mix of collations" error during DB dump */
            THEN CONCAT(
              LPAD(att_grade_effect.${thresholdColumn}, 10, '0') COLLATE utf8mb4_bin,
              '|' COLLATE utf8mb4_bin,
              COALESCE(CAST(att_grade_effect.${valueColumn} AS CHAR), '') COLLATE utf8mb4_bin
            )
            ELSE NULL END
          ) COLLATE utf8mb4_bin,
          '|', -1
        ),
        '0'
      ) AS SIGNED
    ) + 0
  `;
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
    .addSelect(createEffectExpressionByThreshold('percents', 'effect'), 'effect')
    .addSelect(createEffectExpressionByThreshold('percents', 'effectPercent'), 'effectPercent')
    .from('numbers', 'numbers')
    .leftJoin(UserEntity, 'users', '1 = 1')
    .leftJoin(AttGradeEffectEntity, 'att_grade_effect', 'att_grade_effect.user_id = users.id')
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
    .addSelect(createEffectExpressionByThreshold('count', 'effect'), 'effect')
    .addSelect(createEffectExpressionByThreshold('count', 'effectPercent'), 'effectPercent')
    .from('numbers', 'numbers')
    .leftJoin(UserEntity, 'users', '1 = 1')
    .leftJoin(AttGradeEffectEntity, 'att_grade_effect', 'att_grade_effect.user_id = users.id')
    .groupBy('users.id')
    .addGroupBy('numbers.number')
    .orderBy('users.id')
    .addOrderBy('numbers.number');
}