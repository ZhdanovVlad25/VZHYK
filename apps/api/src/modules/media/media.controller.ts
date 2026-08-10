import {
  Body,
  Controller,
  Delete,
  Get,
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

/** docs/api.md §6 Media — GET публічний, решта (upload/patch/delete) лише власник оголошення. */
@Controller('listings/:listingId/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@Param('listingId') listingId: string) {
    return this.media.listForListing(listingId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @Param('mediaId') mediaId: string,
    @Body() dto: UpdateMediaDto,
  ) {
    return this.media.update(user.id, listingId, mediaId, dto);
  }

  @Delete(':mediaId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('listingId') listingId: string,
    @Param('mediaId') mediaId: string,
  ) {
    await this.media.remove(user.id, listingId, mediaId);
  }
}
