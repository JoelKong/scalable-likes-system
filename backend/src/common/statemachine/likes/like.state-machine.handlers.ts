import { StateMachineEventHandler } from '../Istatemachine';
import { LikeStatusEvent } from './like.state-machine.events';
import { Like } from '../../entities/like.entity';
import { LikeStatus } from 'src/common/enums/like-status.enum';

export type LikeStateHandler = StateMachineEventHandler<
  LikeStatus,
  LikeStatusEvent,
  Like
>;

export class LikeStateHandlers {
  public static setStatusHandler: LikeStateHandler = (
    fromState,
    toState,
    event,
    entity,
  ) => {
    if (entity) {
      entity.status = toState;

      // Increment retry count when moving to retrying state
      if (toState === LikeStatus.RETRYING) {
        entity.retry_count = (entity.retry_count || 0) + 1;
      }
    } else {
      throw new Error(
        `State machine handler for event '${event}' from '${fromState}' to '${toState}' was called without an entity.`,
      );
    }
  };
}
