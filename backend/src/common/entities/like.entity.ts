import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { LikeStatus } from '../enums/like-status.enum';

@Entity('likes')
@Index(['post_id', 'user_id'], { unique: true })
export class Like {
  @PrimaryGeneratedColumn('uuid')
  event_id: string;

  @Column({ type: 'bigint' })
  @Index()
  post_id: number;

  @Column({ type: 'bigint' })
  @Index()
  user_id: number;

  @Column({
    type: 'enum',
    enum: LikeStatus,
    default: LikeStatus.PENDING,
  })
  status: LikeStatus;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @CreateDateColumn()
  created_at: Date;
}
