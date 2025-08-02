import { ApiProperty } from '@nestjs/swagger';

export class LikeCountResponseDto {
  @ApiProperty({
    description: 'Current number of likes for the post',
    example: 42,
  })
  count: number;

  @ApiProperty({
    description: 'Post identifier',
    example: 123,
  })
  post_id: number;
}
