import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CreateStationDto } from './dto/create-station.dto';
import { UpdateStationActiveStateDto } from './dto/update-station-active-state.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { StationsService } from './stations.service';

@Controller('stations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN)
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Post()
  create(@Body() dto: CreateStationDto, @CurrentUser() user: AuthUser) {
    return this.stationsService.create(user.branchId, user.sub, dto);
  }

  @Get()
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER, APP_ROLES.PRODUCTION)
  findAll(@CurrentUser() user: AuthUser) {
    const isProduction = user.roles.includes(APP_ROLES.PRODUCTION) && !user.roles.includes(APP_ROLES.ADMIN);
    return this.stationsService.findAll(user.branchId, { includeInactive: !isProduction });
  }

  @Get(':id')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER, APP_ROLES.PRODUCTION)
  findById(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    const requireActive = user.roles.includes(APP_ROLES.PRODUCTION) && !user.roles.includes(APP_ROLES.ADMIN);
    return this.stationsService.findById(user.branchId, id, { requireActive });
  }

  @Patch(':id')
  update(@Param('id', ParseCuidPipe) id: string, @Body() dto: UpdateStationDto, @CurrentUser() user: AuthUser) {
    return this.stationsService.update(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.stationsService.remove(user.branchId, id, user.sub);
  }

  @Patch(':id/active-state')
  updateActiveState(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateStationActiveStateDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stationsService.updateActiveState(user.branchId, id, user.sub, dto);
  }
}
