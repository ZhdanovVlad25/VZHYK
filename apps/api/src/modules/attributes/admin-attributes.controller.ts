import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AttributesService } from './attributes.service';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

/** docs/api.md §4 Categories & Attributes — admin write-endpoints. */
@Controller('admin/attributes')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminAttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAttributeDto) {
    return this.attributes.update(id, dto);
  }
}
