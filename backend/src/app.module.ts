import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ResumeModule } from './likes/like.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { CorrelationIdMiddleware } from './common/middlewares/correlation-id';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resume } from './common/entities/resume.entity';
import { S3Service } from './s3/s3.service';
import { S3Module } from './s3/s3.module';
import { LlmModule } from './llm/llm.module';
import configuration from './common/config/config-loader';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [Resume],
        synchronize: false,
      }),
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
