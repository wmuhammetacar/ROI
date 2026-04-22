import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { InventoryService } from './inventory.service';

@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN)
export class UnitsController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  create(@Body() dto: CreateUnitDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.createUnit(user.sub, dto);
  }

  @Get()
  findAll() {
    return this.inventoryService.listUnits();
  }

  @Get(':id')
  findById(@Param('id', ParseCuidPipe) id: string) {
    return this.inventoryService.getUnitById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateUnitDto, @CurrentUser() user: AuthUser) {
    return this.inventoryService.updateUnit(id, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.inventoryService.deleteUnit(id, user.sub);
  }
}

