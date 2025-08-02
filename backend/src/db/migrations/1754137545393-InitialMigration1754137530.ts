import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration17541375301754137545393 implements MigrationInterface {
    name = 'InitialMigration17541375301754137545393'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."likes_status_enum" AS ENUM('PENDING', 'RETRYING', 'SUCCESS', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "likes" ("event_id" uuid NOT NULL DEFAULT uuid_generate_v4(), "post_id" bigint NOT NULL, "user_id" bigint NOT NULL, "status" "public"."likes_status_enum" NOT NULL DEFAULT 'PENDING', "retry_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a05fbc4d12da60ccb27e19b4ed3" PRIMARY KEY ("event_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_741df9b9b72f328a6d6f63e79f" ON "likes" ("post_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f519ed95f775c781a25408917" ON "likes" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_723da61de46f65bb3e3096750d" ON "likes" ("post_id", "user_id") `);
        await queryRunner.query(`CREATE TABLE "posts" ("id" BIGSERIAL NOT NULL, "like_count" bigint NOT NULL DEFAULT '0', CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "posts"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_723da61de46f65bb3e3096750d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f519ed95f775c781a25408917"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_741df9b9b72f328a6d6f63e79f"`);
        await queryRunner.query(`DROP TABLE "likes"`);
        await queryRunner.query(`DROP TYPE "public"."likes_status_enum"`);
    }

}
