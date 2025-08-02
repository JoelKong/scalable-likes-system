import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { LikeService } from './like.service';
import { LikeRequestDto } from './dtos/request/like.request.dto';
import { LikeResponseDto } from './dtos/response/like.response.dto';
import { LikeCountResponseDto } from './dtos/response/like-count.response.dto';

@ApiTags('likes')
@Controller('like')
export class LikeController {
  private readonly logger = new Logger(LikeController.name);

  constructor(private readonly likeService: LikeService) {}

  @Post()
  @ApiOperation({
    summary: 'Toggle like/unlike for a post',
    description:
      'Increments Redis counter immediately and queues database write via Kafka for eventual consistency',
  })
  @ApiBody({ type: LikeRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Like toggled successfully',
    type: LikeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request payload',
  })
  async toggleLike(
    @Body() likeRequestDto: LikeRequestDto,
  ): Promise<LikeResponseDto> {
    this.logger.log(
      `Received like toggle request for post ${likeRequestDto.post_id}, user ${likeRequestDto.user_id}`,
    );
    return this.likeService.toggleLike(likeRequestDto);
  }

  @Get('count/:postId')
  @ApiOperation({
    summary: 'Get like count for a post',
    description: 'Returns real-time like count from Redis cache layer',
  })
  @ApiParam({
    name: 'postId',
    type: 'number',
    description: 'Unique identifier of the post',
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: 'Like count retrieved successfully',
    type: LikeCountResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Post not found',
  })
  async getLikeCount(
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<LikeCountResponseDto> {
    this.logger.log(`Received request for like count of post ${postId}`);
    return this.likeService.getLikeCount(postId);
  }
}
