import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LikeRepository } from 'src/likes/like.repository';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly likeRepository: LikeRepository,
    private readonly redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncDatabaseToRedis(): Promise<void> {
    this.logger.log('Starting DB to Redis sync job');

    try {
      // Get all unique post IDs from the database
      const postIds = await this.likeRepository.getAllPostIds();

      this.logger.log(`Syncing ${postIds.length} posts from DB to Redis`);

      for (const postId of postIds) {
        try {
          const dbCount = await this.likeRepository.getLikeCount(postId);
          await this.redisService.setLikeCount(postId, dbCount);

          this.logger.debug(
            `Synced post ${postId}: DB count ${dbCount} → Redis`,
          );
        } catch (error) {
          this.logger.error(`Failed to sync post ${postId}`, error.stack);
        }
      }

      this.logger.log('DB to Redis sync job completed successfully');
    } catch (error) {
      this.logger.error('DB to Redis sync job failed', error.stack);
    }
  }

  // Manual sync for specific post
  async syncSpecificPost(postId: number): Promise<void> {
    this.logger.log(`Manual sync requested for post ${postId}`);

    try {
      const dbCount = await this.likeRepository.getLikeCount(postId);
      await this.redisService.setLikeCount(postId, dbCount);

      this.logger.log(`Successfully synced post ${postId}: count = ${dbCount}`);
    } catch (error) {
      this.logger.error(`Failed to manually sync post ${postId}`, error.stack);
      throw error;
    }
  }

  // Sync all Redis keys from DB (useful for Redis cold start)
  async warmRedisFromDatabase(): Promise<void> {
    this.logger.log('Warming Redis from database...');
    await this.syncDatabaseToRedis();
  }
}
