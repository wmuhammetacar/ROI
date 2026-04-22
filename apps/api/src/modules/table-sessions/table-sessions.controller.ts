import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { OpenTableSessionDto } from './dto/open-table-session.dto';
import { TableSessionsService } from './table-sessions.service';

@Controller('table-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
export class TableSessionsController {
  constructor(private readonly tableSessionsService: TableSessionsService) {}

  @Post('open')
  open(@Body() dto: OpenTableSessionDto, @CurrentUser() user: AuthUser) {
    return this.tableSessionsService.open(user.branchId, user.sub, dto);
  }

  @Post(':id/close')
  close(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tableSessionsService.close(user.branchId, id, user.sub);
  }

  @Get('open/by-table/:tableId')
  findOpenByTable(@Param('tableId', ParseCuidPipe) tableId: string, @CurrentUser() user: AuthUser) {
    return this.tableSessionsService.findOpenByTable(user.branchId, tableId);
  }

  @Get(':id')
  findById(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.tableSessionsService.findById(user.branchId, id);
  }
}
