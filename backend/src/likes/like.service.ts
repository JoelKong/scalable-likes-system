import { Injectable, Logger } from '@nestjs/common';
import { LikeRepository } from './like.repository';
import { LikeRequestDto } from './dtos/request/like.request.dto';
import { LikeResponseDto } from './dtos/response/like.response.dto';
import { LikeCountResponseDto } from './dtos/response/like-count.response.dto';
import { v4 as uuidv4 } from 'uuid';
import { LikeEventDto } from 'src/kafka/events/kafka.event.dto';
import { KafkaService } from 'src/kafka/kafka.service';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class LikeService {
  private readonly logger = new Logger(LikeService.name);

  constructor(
    private readonly likeRepository: LikeRepository,
    private readonly redisService: RedisService,
    private readonly kafkaService: KafkaService,
  ) {}

  async toggleLike(likeRequestDto: LikeRequestDto): Promise<LikeResponseDto> {
    const { post_id, user_id } = likeRequestDto;

    this.logger.log(
      `Processing like toggle for post ${post_id}, user ${user_id}`,
    );

    try {
      // Check if user already liked this post (from DB for accuracy)
      const existingLike = await this.likeRepository.findLikeByPostAndUser(
        post_id,
        user_id,
      );

      let newCount: number;
      let message: string;
      let action: 'LIKE' | 'UNLIKE';

      if (existingLike) {
        // Unlike - decrement Redis count immediately
        newCount = await this.redisService.decrementLikeCount(post_id);
        action = 'UNLIKE';
        message = 'Post unliked successfully';

        this.logger.log(
          `User ${user_id} unliked post ${post_id}, Redis count: ${newCount}`,
        );
      } else {
        // Like - increment Redis count immediately
        newCount = await this.redisService.incrementLikeCount(post_id);
        action = 'LIKE';
        message = 'Post liked successfully';

        this.logger.log(
          `User ${user_id} liked post ${post_id}, Redis count: ${newCount}`,
        );
      }

      // Create event for Kafka
      const eventId = uuidv4();
      const likeEvent: LikeEventDto = {
        event_id: eventId,
        post_id,
        user_id,
        action,
        timestamp: new Date(),
      };

      // Produce event to Kafka for asynchronous database processing
      await this.kafkaService.produceLikeEvent(likeEvent);

      return {
        success: true,
        message,
        likeCount: newCount, // Return the Redis count for real-time response
      };
    } catch (error) {
      this.logger.error(
        `Failed to toggle like for post ${post_id}, user ${user_id}`,
        error.stack,
      );
      return {
        success: false,
        message: 'Failed to process like',
      };
    }
  }

  async getLikeCount(postId: number): Promise<LikeCountResponseDto> {
    this.logger.log(`Fetching like count for post ${postId} from Redis`);

    try {
      // Get count from Redis first (fast access layer)
      let count = await this.redisService.getLikeCount(postId);

      // If Redis doesn't have the count, warm it up from DB
      if (count === 0) {
        this.logger.log(
          `Redis cache miss for post ${postId}, warming up from DB`,
        );
        await this.likeRepository.ensurePostExists(postId);
        const dbCount = await this.likeRepository.getLikeCount(postId);
        await this.redisService.setLikeCount(postId, dbCount);
        count = dbCount;
      }

      return {
        count,
        post_id: postId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch like count for post ${postId}`,
        error.stack,
      );

      // Fallback to DB if Redis fails
      try {
        await this.likeRepository.ensurePostExists(postId);
        const dbCount = await this.likeRepository.getLikeCount(postId);
        return {
          count: dbCount,
          post_id: postId,
        };
      } catch (dbError) {
        this.logger.error(
          `DB fallback also failed for post ${postId}`,
          dbError.stack,
        );
        return {
          count: 0,
          post_id: postId,
        };
      }
    }
  }

  // Background sync method (this would be a separate service/cron job in production)
  async syncRedisFromDatabase(postId: number): Promise<void> {
    this.logger.log(`Syncing Redis count from DB for post ${postId}`);
    try {
      const dbCount = await this.likeRepository.getLikeCount(postId);
      await this.redisService.setLikeCount(postId, dbCount);
      this.logger.log(
        `Synced post ${postId}: Redis count updated to ${dbCount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync post ${postId} from DB to Redis`,
        error.stack,
      );
    }
  }
}
