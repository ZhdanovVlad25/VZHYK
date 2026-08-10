import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MediaService, MAX_MEDIA_SIZE_BYTES } from './media.service';
import { UpdateMediaDto } from './dto/update-media.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../shared/decorators/current-user.decorator';

/** docs/api.md §6 Media — завантаження/керування фото оголошення (лише власник). */
@Controller('listings/:listingId/media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_MEDIA_SIZE_BYTES } }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.media.upload(user.id, listingId, file);
  }

  @Patch(':mediaId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.media.update(user.id, listingId, mediaId, dto);
  }

  @Delete(':mediaId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @Param('mediaId') mediaId: string,
  ) {
    await this.media.remove(user.id, listingId, mediaId);
  }
}
