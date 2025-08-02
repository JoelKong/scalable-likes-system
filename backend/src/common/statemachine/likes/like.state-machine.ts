import { Transition } from '../Istatemachine';
import { LikeStatusEvent } from './like.state-machine.events';
import { Like } from '../../entities/like.entity';
import { LikeStateHandlers } from './like.state-machine.handlers';
import { LikeStatus } from 'src/common/enums/like-status.enum';

export const likeTransitions: Transition<LikeStatus, LikeStatusEvent, Like>[] =
  [
    {
      fromState: LikeStatus.PENDING,
      toState: LikeStatus.RETRYING,
      stateMachineEvent: LikeStatusEvent.SET_RETRYING,
      handlers: [LikeStateHandlers.setStatusHandler],
    },
    {
      fromState: LikeStatus.PENDING,
      toState: LikeStatus.SUCCESS,
      stateMachineEvent: LikeStatusEvent.SET_SUCCESS,
      handlers: [LikeStateHandlers.setStatusHandler],
    },
    {
      fromState: LikeStatus.PENDING,
      toState: LikeStatus.FAILED,
      stateMachineEvent: LikeStatusEvent.SET_FAILED,
      handlers: [LikeStateHandlers.setStatusHandler],
    },
    {
      fromState: LikeStatus.RETRYING,
      toState: LikeStatus.SUCCESS,
      stateMachineEvent: LikeStatusEvent.SET_SUCCESS,
      handlers: [LikeStateHandlers.setStatusHandler],
    },
    {
      fromState: LikeStatus.RETRYING,
      toState: LikeStatus.FAILED,
      stateMachineEvent: LikeStatusEvent.SET_FAILED,
      handlers: [LikeStateHandlers.setStatusHandler],
    },
    {
      fromState: LikeStatus.RETRYING,
      toState: LikeStatus.RETRYING,
      stateMachineEvent: LikeStatusEvent.SET_RETRYING,
      handlers: [LikeStateHandlers.setStatusHandler],
    },
  ];
