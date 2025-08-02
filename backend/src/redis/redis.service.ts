import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on('connect', () => {
      this.logger.log('Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error('Redis connection error:', error);
    });
  }

  async incrementLikeCount(postId: number): Promise<number> {
    const key = `post:${postId}:like_count`;
    return await this.client.incr(key);
  }

  async decrementLikeCount(postId: number): Promise<number> {
    const key = `post:${postId}:like_count`;
    const newCount = await this.client.decr(key);
    if (newCount < 0) {
      await this.client.set(key, 0);
      return 0;
    }
    return newCount;
  }

  async getLikeCount(postId: number): Promise<number> {
    const key = `post:${postId}:like_count`;
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async setLikeCount(postId: number, count: number): Promise<void> {
    const key = `post:${postId}:like_count`;
    await this.client.set(key, count);
  }

  onModuleDestroy() {
    this.client.disconnect();
  }
}
