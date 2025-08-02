import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs';
import { LikeEventDto } from './events/kafka.event.dto';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;

  constructor(private configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: 'scalable-likes-service',
      brokers: [this.configService.get<string>('KAFKA_BROKER', 'kafka:9092')],
      // Add connection timeout settings
      connectionTimeout: 30000,
      requestTimeout: 25000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });

    this.consumer = this.kafka.consumer({
      groupId: 'like-events-group',
      // Add consumer-specific configurations to prevent rebalancing
      sessionTimeout: 30000,
      rebalanceTimeout: 60000,
      heartbeatInterval: 3000,
      maxBytesPerPartition: 1048576,
      minBytes: 1,
      maxBytes: 10485760,
      maxWaitTimeInMs: 5000,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      this.logger.log('Kafka producer and consumer connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', error.stack);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      this.logger.log('Kafka producer and consumer disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka', error.stack);
    }
  }

  async produceLikeEvent(likeEvent: LikeEventDto): Promise<void> {
    try {
      await this.producer.send({
        topic: 'like-events',
        messages: [
          {
            key: likeEvent.event_id,
            value: JSON.stringify(likeEvent),
            headers: {
              event_id: likeEvent.event_id,
              post_id: likeEvent.post_id.toString(),
              user_id: likeEvent.user_id.toString(),
            },
          },
        ],
      });

      this.logger.log(`Produced like event: ${likeEvent.event_id}`);
    } catch (error) {
      this.logger.error(
        `Failed to produce like event: ${likeEvent.event_id}`,
        error.stack,
      );
      throw error;
    }
  }

  async consumeLikeEvents(
    messageHandler: (payload: EachMessagePayload) => Promise<void>,
  ): Promise<void> {
    await this.consumer.subscribe({
      topic: 'like-events',
      fromBeginning: false,
    });

    await this.consumer.run({
      // Add more robust message processing configuration
      partitionsConsumedConcurrently: 1,
      eachMessage: async (payload) => {
        const { topic, partition, message } = payload;
        this.logger.debug(
          `Processing message from ${topic}-${partition} at offset ${message.offset}`,
        );

        try {
          await messageHandler(payload);
        } catch (error) {
          this.logger.error(
            `Error processing Kafka message at offset ${message.offset}`,
            error.stack,
          );
          // Don't rethrow here to prevent consumer from crashing
        }
      },
    });

    this.logger.log('Kafka consumer started for like-events topic');
  }

  async sendToDeadLetterQueue(
    originalMessage: any,
    error: Error,
  ): Promise<void> {
    try {
      await this.producer.send({
        topic: 'like-events-dlq',
        messages: [
          {
            key: originalMessage.key,
            value: JSON.stringify({
              originalMessage: originalMessage.value,
              error: error.message,
              timestamp: new Date().toISOString(),
            }),
            headers: originalMessage.headers,
          },
        ],
      });

      this.logger.log(`Sent message to DLQ: ${originalMessage.key}`);
    } catch (dlqError) {
      this.logger.error('Failed to send message to DLQ', dlqError.stack);
    }
  }
}
