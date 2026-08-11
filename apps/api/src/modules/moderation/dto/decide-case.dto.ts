import { IsIn } from 'class-validator';
import { MODERATION_DECISIONS, ModerationDecision } from '../moderation.constants';

export class DecideCaseDto {
  @IsIn(MODERATION_DECISIONS)
  decision: ModerationDecision;
}
