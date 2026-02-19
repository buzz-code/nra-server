import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSharedEntities1767648000000 implements MigrationInterface {
    name = 'InitSharedEntities1767648000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const dbName = queryRunner.connection.options.database;

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`users\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`name\` varchar(500) NOT NULL,
                \`email\` varchar(500) DEFAULT NULL,
                \`password\` varchar(500) DEFAULT NULL,
                \`phone_number\` varchar(11) DEFAULT NULL,
                \`active\` tinyint DEFAULT NULL,
                \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`effective_id\` int DEFAULT NULL,
                \`permissions\` text DEFAULT NULL,
                \`additionalData\` text DEFAULT NULL,
                \`userInfo\` text DEFAULT NULL,
                \`isPaid\` tinyint NOT NULL DEFAULT 0,
                \`paymentMethod\` varchar(255) DEFAULT NULL,
                \`mailAddressAlias\` varchar(255) DEFAULT NULL,
                \`mailAddressTitle\` varchar(255) DEFAULT NULL,
                \`paymentTrackId\` int DEFAULT NULL,
                \`bccAddress\` varchar(255) DEFAULT NULL,
                PRIMARY KEY (\`id\`),
                KEY \`user_phone_number_idx\` (\`phone_number\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`audit_log\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` int NOT NULL,
                \`entityId\` int NOT NULL,
                \`entityName\` varchar(255) NOT NULL,
                \`operation\` varchar(255) NOT NULL,
                \`entityData\` text NOT NULL,
                \`isReverted\` tinyint NOT NULL DEFAULT 0,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`image\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` int NOT NULL,
                \`fileDataSrc\` mediumtext NOT NULL,
                \`fileDataTitle\` text NOT NULL,
                \`imageTarget\` varchar(255) NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`IDX_35596848f8bb8f7b5ec5fcf9e0\` (\`userId\`, \`imageTarget\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`import_file\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` int NOT NULL,
                \`fileName\` varchar(255) NOT NULL,
                \`fileSource\` varchar(255) NOT NULL,
                \`entityIds\` text NOT NULL,
                \`entityName\` varchar(255) NOT NULL,
                \`fullSuccess\` tinyint DEFAULT NULL,
                \`response\` varchar(255) NOT NULL,
                \`metadata\` json DEFAULT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                KEY \`import_file_user_id_idx\` (\`userId\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`mail_address\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` int NOT NULL,
                \`alias\` varchar(255) NOT NULL,
                \`entity\` varchar(255) NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`IDX_10d2242b0e45f6add0b4269cbf\` (\`userId\`, \`entity\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`page\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`description\` varchar(255) NOT NULL,
                \`value\` longtext NOT NULL,
                \`order\` int DEFAULT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`payment_track\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`name\` varchar(255) NOT NULL,
                \`description\` longtext NOT NULL,
                \`monthlyPrice\` int NOT NULL,
                \`annualPrice\` int NOT NULL,
                \`studentNumberLimit\` int NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`recieved_mail\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` int NOT NULL,
                \`mailData\` text NOT NULL,
                \`from\` varchar(255) NOT NULL,
                \`to\` varchar(255) NOT NULL,
                \`subject\` text DEFAULT NULL,
                \`body\` text DEFAULT NULL,
                \`entityName\` varchar(255) NOT NULL,
                \`importFileIds\` text NOT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`texts\` (
                \`id\` int UNSIGNED NOT NULL AUTO_INCREMENT,
                \`user_id\` int NOT NULL,
                \`name\` varchar(100) NOT NULL,
                \`description\` varchar(500) NOT NULL,
                \`value\` varchar(10000) NOT NULL,
                \`filepath\` varchar(255) DEFAULT NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                KEY \`texts_users_idx\` (\`user_id\`),
                KEY \`texts_name_idx\` (\`name\`),
                KEY \`texts_user_id_name_idx\` (\`user_id\`, \`name\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS \`yemot_call\` (
                \`id\` int NOT NULL AUTO_INCREMENT,
                \`userId\` int NOT NULL,
                \`apiCallId\` varchar(255) NOT NULL,
                \`phone\` varchar(255) NOT NULL,
                \`history\` mediumtext NOT NULL,
                \`currentStep\` varchar(255) NOT NULL,
                \`data\` text DEFAULT NULL,
                \`isOpen\` tinyint NOT NULL,
                \`hasError\` tinyint NOT NULL DEFAULT 0,
                \`errorMessage\` varchar(255) DEFAULT NULL,
                \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                PRIMARY KEY (\`id\`),
                KEY \`yemot_call_api_call_id_idx\` (\`apiCallId\`),
                CONSTRAINT \`FK_2f2c39a9491ac1a6e2d7827bb53\` FOREIGN KEY (\`userId\`) REFERENCES \`users\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        const hasTextByUserView = await queryRunner.hasTable('text_by_user');
        if (!hasTextByUserView) {
            await queryRunner.query(`
                CREATE VIEW \`text_by_user\` AS
                SELECT \`t_base\`.\`name\` AS \`name\`,
                    \`t_base\`.\`description\` AS \`description\`,
                    \`users\`.\`id\` AS \`userId\`,
                    \`t_user\`.\`id\` AS \`overrideTextId\`,
                    CONCAT(\`users\`.\`id\`, "_", \`t_base\`.\`id\`) AS \`id\`,
                    COALESCE(\`t_user\`.\`value\`, \`t_base\`.\`value\`) AS \`value\`,
                    COALESCE(\`t_user\`.\`filepath\`, \`t_base\`.\`filepath\`) AS \`filepath\`
                FROM \`texts\` \`t_base\`
                    LEFT JOIN \`users\` \`users\` ON \`users\`.\`effective_id\` is null
                    LEFT JOIN \`texts\` \`t_user\` ON \`t_user\`.\`name\` = \`t_base\`.\`name\`
                    AND \`t_user\`.\`user_id\` = \`users\`.\`id\`
                WHERE \`t_base\`.\`user_id\` = 0
                ORDER BY \`users\`.\`id\` ASC, \`t_base\`.\`id\` ASC
            `);
            await queryRunner.query(`
                INSERT INTO \`${dbName}\`.\`typeorm_metadata\`(\`database\`, \`schema\`, \`table\`, \`type\`, \`name\`, \`value\`)
                VALUES (DEFAULT, ?, DEFAULT, ?, ?, ?)
            `, [dbName, "VIEW", "text_by_user", "SELECT `t_base`.`name` AS `name`, `t_base`.`description` AS `description`, `users`.`id` AS `userId`, `t_user`.`id` AS `overrideTextId`, CONCAT(`users`.`id`, \"_\", `t_base`.`id`) AS `id`, COALESCE(`t_user`.`value`, `t_base`.`value`) AS `value`, COALESCE(`t_user`.`filepath`, `t_base`.`filepath`) AS `filepath` FROM `texts` `t_base` LEFT JOIN `users` `users` ON `users`.`effective_id` is null  LEFT JOIN `texts` `t_user` ON `t_user`.`name` = `t_base`.`name` AND `t_user`.`user_id` = `users`.`id` WHERE `t_base`.`user_id` = 0 ORDER BY `users`.`id` ASC, `t_base`.`id` ASC"]);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const dbName = queryRunner.connection.options.database;
        await queryRunner.query(`
            DELETE FROM \`${dbName}\`.\`typeorm_metadata\`
            WHERE \`type\` = ? AND \`name\` = ? AND \`schema\` = ?
        `, ["VIEW", "text_by_user", dbName]);
        await queryRunner.query(`DROP VIEW IF EXISTS \`text_by_user\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`yemot_call\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`texts\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`recieved_mail\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`payment_track\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`page\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`mail_address\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`import_file\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`image\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`audit_log\``);
        await queryRunner.query(`DROP TABLE IF EXISTS \`users\``);
    }
}
