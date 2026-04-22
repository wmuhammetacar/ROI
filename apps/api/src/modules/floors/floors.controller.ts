import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { FloorsService } from './floors.service';

@Controller('floors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FloorsController {
  constructor(private readonly floorsService: FloorsService) {}

  @Post()
  @Roles(APP_ROLES.ADMIN)
  create(@Body() dto: CreateFloorDto, @CurrentUser() user: AuthUser) {
    return this.floorsService.create(user.branchId, user.sub, dto);
  }

  @Get()
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  findAll(@CurrentUser() user: AuthUser) {
    return this.floorsService.findAll(user.branchId);
  }

  @Get(':id')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  findById(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.floorsService.findById(user.branchId, id);
  }

  @Patch(':id')
  @Roles(APP_ROLES.ADMIN)
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateFloorDto, @CurrentUser() user: AuthUser) {
    return this.floorsService.update(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(APP_ROLES.ADMIN)
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.floorsService.remove(user.branchId, id, user.sub);
  }
}
