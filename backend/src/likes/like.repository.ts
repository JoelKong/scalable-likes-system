import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Like } from '../common/entities/like.entity';
import { Post } from '../common/entities/post.entity';
import { LikeStatus } from 'src/common/enums/like-status.enum';

@Injectable()
export class LikeRepository {
  private readonly logger = new Logger(LikeRepository.name);

  constructor(
    @InjectRepository(Like)
    private readonly likeRepository: Repository<Like>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async createLike(
    postId: number,
    userId: number,
    eventId: string,
  ): Promise<Like> {
    this.logger.log(
      `Creating like record for post ${postId}, user ${userId}, event ${eventId}`,
    );

    const like = this.likeRepository.create({
      post_id: postId,
      user_id: userId,
      event_id: eventId,
      status: LikeStatus.PENDING,
      retry_count: 0,
    });

    return this.likeRepository.save(like);
  }

  async findLikeByPostAndUser(
    postId: number,
    userId: number,
  ): Promise<Like | null> {
    this.logger.log(`Finding like for post ${postId} and user ${userId}`);
    return this.likeRepository.findOne({
      where: { post_id: postId, user_id: userId },
    });
  }

  async findLikeByEventId(eventId: string): Promise<Like | null> {
    this.logger.log(`Finding like by event ID: ${eventId}`);
    return this.likeRepository.findOne({
      where: { event_id: eventId },
    });
  }

  async updateLike(like: Like): Promise<Like> {
    this.logger.log(
      `Updating like status for event ${like.event_id} to ${like.status}`,
    );
    return this.likeRepository.save(like);
  }

  async deleteLike(postId: number, userId: number): Promise<void> {
    this.logger.log(`Deleting like for post ${postId} and user ${userId}`);
    await this.likeRepository.delete({
      post_id: postId,
      user_id: userId,
    });
  }

  async getLikeCount(postId: number): Promise<number> {
    this.logger.log(`Getting like count for post ${postId}`);
    return this.likeRepository.count({
      where: {
        post_id: postId,
        status: LikeStatus.SUCCESS, // Only count successfully processed likes
      },
    });
  }

  async ensurePostExists(postId: number): Promise<Post> {
    this.logger.log(`Ensuring post ${postId} exists`);

    let post = await this.postRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      this.logger.log(`Creating new post record for ${postId}`);
      post = this.postRepository.create({
        id: postId,
        like_count: 0,
      });
      post = await this.postRepository.save(post);
    }

    return post;
  }

  async updatePostLikeCount(postId: number, count: number): Promise<void> {
    this.logger.log(`Updating post ${postId} like count to ${count}`);
    await this.postRepository.update({ id: postId }, { like_count: count });
  }

  async getAllPostIds(): Promise<number[]> {
    this.logger.log('Fetching all unique post IDs from database');

    const result = await this.postRepository
      .createQueryBuilder('post')
      .select('post.id')
      .getMany();

    return result.map((post) => post.id);
  }
}
