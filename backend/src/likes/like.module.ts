import { Module } from '@nestjs/common';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Like } from '../common/entities/like.entity';
import { Post } from '../common/entities/post.entity';
import { LikeRepository } from './like.repository';
import { KafkaService } from 'src/kafka/kafka.service';
import { RedisService } from 'src/redis/redis.service';
import { KafkaConsumerService } from './kafka.consumer.service';
import { SyncService } from 'src/sync/sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([Like, Post])],
  controllers: [LikeController],
  providers: [
    LikeService,
    LikeRepository,
    RedisService,
    KafkaService,
    KafkaConsumerService,
    SyncService,
  ],
  exports: [LikeService, LikeRepository, RedisService, KafkaService],
})
export class LikeModule {}
