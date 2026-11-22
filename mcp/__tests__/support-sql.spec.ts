import { scopeSql } from '../support/support-sql';

const options = {
  tables: {
    games: { userColumn: 'user_id' },
    game_nodes: { userColumn: 'user_id' },
    users: { table: 'users', userColumn: 'id', columns: ['id', 'name'] },
  },
  database: 'app_db',
  existingTables: new Set(['games', 'game_nodes', 'users', 'secrets']),
  userId: 7,
  maxRows: 100,
};

const scope = (sql: string) => scopeSql(sql, options);

describe('scopeSql', () => {
  it('shadows each table it reads with that user\'s rows, and caps the rows', () => {
    expect(scope('select name from games where id > 3')).toBe(
      'WITH `games` AS (SELECT * FROM `app_db`.`games` WHERE `user_id` = 7) SELECT `name` FROM `games` WHERE `id` > 3 LIMIT 100',
    );
  });

  it('scopes every table in joins and subqueries', () => {
    const sql = scope('select g.name, (select count(*) from game_nodes n where n.game_id = g.id) c from games g');
    expect(sql).toContain('`game_nodes` AS (SELECT * FROM `app_db`.`game_nodes` WHERE `user_id` = 7)');
    expect(sql).toContain('`games` AS (SELECT * FROM `app_db`.`games` WHERE `user_id` = 7)');
  });

  it('reads only the safe columns of the user itself', () => {
    expect(scope('select * from users')).toContain('`users` AS (SELECT `id`, `name` FROM `app_db`.`users` WHERE `id` = 7)');
  });

  it('keeps the query\'s own CTEs after the scoped ones', () => {
    expect(scope('with recursive r as (select id from games) select * from r')).toBe(
      'WITH RECURSIVE `games` AS (SELECT * FROM `app_db`.`games` WHERE `user_id` = 7), `r` AS (SELECT `id` FROM `games`) SELECT * FROM `r` LIMIT 100',
    );
  });

  it('lowers a larger LIMIT and keeps a smaller one', () => {
    expect(scope('select id from games limit 5, 5000')).toMatch(/LIMIT 5, 100$/);
    expect(scope('select id from games limit 3')).toMatch(/LIMIT 3$/);
    expect(scope('select id from games union select id from game_nodes limit 900')).toMatch(/LIMIT 100$/);
  });

  it('drops comments, so a MySQL executable comment never runs', () => {
    expect(scope('select id from games /*! , password */')).not.toContain('password');
  });

  it.each([
    ['delete from games', /single SELECT/],
    ['update games set name = 1', /single SELECT/],
    ['drop table games', /single SELECT|parse/],
    ['select 1; delete from games', /single SELECT/],
    ['select * from secrets', /not available/],
    ['select * from app_db.games', /without a database/],
    ['select * from information_schema.tables', /without a database/],
    ['select * from mysql.user', /without a database/],
    ['select * from games into outfile "/tmp/x"', /INTO/],
    ['select * from games for update', /Locking/],
    ['select load_file("/etc/passwd")', /function/],
    ['select sleep(10)', /function/],
    ['select benchmark(100000000, md5(1))', /function/],
    ['select * from (with x as (select * from secrets) select * from x) t', /not available/],
    ['select nonsense from', /parse/],
    ['with games as (select * from games) select * from games', /CTE may not be named/],
    ['with secrets as (select * from secrets) select * from secrets', /CTE may not be named/],
    ['with x as (select 1), USERS as (select * from users) select * from USERS', /CTE may not be named/],
  ])('refuses %s', (sql, error) => {
    expect(() => scope(sql)).toThrow(error);
  });

  it('refuses when no user is selected', () => {
    expect(() => scopeSql('select * from games', { ...options, userId: 0 })).toThrow(/No user/);
  });
});
