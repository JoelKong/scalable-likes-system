export interface LikeEventDto {
  event_id: string;
  post_id: number;
  user_id: number;
  action: 'LIKE' | 'UNLIKE';
  timestamp: Date;
}
