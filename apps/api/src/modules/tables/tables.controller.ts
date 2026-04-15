import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableStatusDto } from './dto/update-table-status.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { TablesService } from './tables.service';

@Controller('tables')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @Roles(APP_ROLES.ADMIN)
  create(@Body() dto: CreateTableDto, @CurrentUser() user: AuthUser) {
    return this.tablesService.create(user.branchId, user.sub, dto);
  }

  @Get()
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  findAll(@CurrentUser() user: AuthUser) {
    return this.tablesService.findAll(user.branchId);
  }

  @Get(':id')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tablesService.findById(user.branchId, id);
  }

  @Patch(':id')
  @Roles(APP_ROLES.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTableDto, @CurrentUser() user: AuthUser) {
    return this.tablesService.update(user.branchId, id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(APP_ROLES.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tablesService.remove(user.branchId, id, user.sub);
  }

  @Patch(':id/status')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTableStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tablesService.updateStatus(user.branchId, id, user.sub, dto);
  }
}
