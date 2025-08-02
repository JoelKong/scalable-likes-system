import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { LikeRepository } from './like.repository';
import { StateMachine } from '../common/statemachine/statemachine';
import { LikeStatusEvent } from '../common/statemachine/likes/like.state-machine.events';
import { Like } from '../common/entities/like.entity';
import { likeTransitions } from '../common/statemachine/likes/like.state-machine';
import { EachMessagePayload } from 'kafkajs';
import { LikeStatus } from 'src/common/enums/like-status.enum';
import { ExponentialBackoff } from 'src/common/utils/exponential-backoff.util';
import type { RetryOptions } from 'src/common/utils/exponential-backoff.util';
import { LikeEventDto } from 'src/kafka/events/kafka.event.dto';
import { KafkaService } from 'src/kafka/kafka.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly stateMachine: StateMachine<
    LikeStatus,
    LikeStatusEvent,
    Like
  >;
  private readonly retryOptions: RetryOptions = {
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
  };

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly likeRepository: LikeRepository,
  ) {
    this.stateMachine = new StateMachine<LikeStatus, LikeStatusEvent, Like>();
    this.stateMachine.register(likeTransitions);
  }

  async onModuleInit() {
    // Start consuming like events
    await this.kafkaService.consumeLikeEvents(this.handleLikeEvent.bind(this));
  }

  private async handleLikeEvent(payload: EachMessagePayload): Promise<void> {
    const { message } = payload;

    try {
      const likeEvent: LikeEventDto = JSON.parse(
        message.value?.toString() || '{}',
      );
      this.logger.log(`Processing like event: ${likeEvent.event_id}`);

      await this.processLikeEventWithRetry(likeEvent);
    } catch (error) {
      this.logger.error('Failed to parse like event message', error.stack);
      await this.kafkaService.sendToDeadLetterQueue(message, error as Error);
    }
  }

  private async processLikeEventWithRetry(
    likeEvent: LikeEventDto,
  ): Promise<void> {
    try {
      await ExponentialBackoff.execute(
        () => this.processLikeEvent(likeEvent),
        this.retryOptions,
        `LikeEvent-${likeEvent.event_id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to process like event ${likeEvent.event_id} after all retries`,
        error.stack,
      );

      // Mark as failed in database
      await this.markLikeEventAsFailed(likeEvent.event_id);

      // Send to dead letter queue
      await this.kafkaService.sendToDeadLetterQueue(
        { key: likeEvent.event_id, value: JSON.stringify(likeEvent) },
        error as Error,
      );
    }
  }

  private async processLikeEvent(likeEvent: LikeEventDto): Promise<void> {
    const { event_id, post_id, user_id, action } = likeEvent;

    // Check if this event was already processed (idempotency)
    const existingLike = await this.likeRepository.findLikeByEventId(event_id);

    if (existingLike && existingLike.status === LikeStatus.SUCCESS) {
      this.logger.log(
        `Event ${event_id} already processed successfully, skipping`,
      );
      return;
    }

    try {
      if (action === 'LIKE') {
        await this.processDatabaseLikeWrite(event_id, post_id, user_id);
      } else if (action === 'UNLIKE') {
        await this.processDatabaseUnlikeWrite(event_id, post_id, user_id);
      }

      this.logger.log(`Successfully processed ${action} event: ${event_id}`);
    } catch (error) {
      // Update retry count and status
      if (existingLike) {
        this.stateMachine.trigger(
          existingLike.status,
          LikeStatusEvent.SET_RETRYING,
          existingLike,
        );
        await this.likeRepository.updateLike(existingLike);
      }

      throw error; // Re-throw to trigger retry mechanism
    }
  }

  private async processDatabaseLikeWrite(
    eventId: string,
    postId: number,
    userId: number,
  ): Promise<void> {
    // Ensure post exists
    await this.likeRepository.ensurePostExists(postId);

    // Try to create or update the like record
    let like = await this.likeRepository.findLikeByEventId(eventId);

    if (!like) {
      // Create new like record
      like = await this.likeRepository.createLike(postId, userId, eventId);
    }

    // Mark as successful
    this.stateMachine.trigger(like.status, LikeStatusEvent.SET_SUCCESS, like);
    await this.likeRepository.updateLike(like);

    // Update post like count
    const totalCount = await this.likeRepository.getLikeCount(postId);
    await this.likeRepository.updatePostLikeCount(postId, totalCount);
  }

  private async processDatabaseUnlikeWrite(
    eventId: string,
    postId: number,
    userId: number,
  ): Promise<void> {
    // Find and delete the like record
    await this.likeRepository.deleteLike(postId, userId);

    // Update post like count
    const totalCount = await this.likeRepository.getLikeCount(postId);
    await this.likeRepository.updatePostLikeCount(postId, totalCount);

    this.logger.log(`Processed unlike for post ${postId}, user ${userId}`);
  }

  private async markLikeEventAsFailed(eventId: string): Promise<void> {
    try {
      const like = await this.likeRepository.findLikeByEventId(eventId);
      if (like) {
        this.stateMachine.trigger(
          like.status,
          LikeStatusEvent.SET_FAILED,
          like,
        );
        await this.likeRepository.updateLike(like);
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark event ${eventId} as failed`,
        error.stack,
      );
    }
  }
}
