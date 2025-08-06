export interface PostCountEventDto {
  event_id: string;
  post_id: number;
  delta: number; // +1 for like, -1 for unlike
  timestamp: Date;
}
