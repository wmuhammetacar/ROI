import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreateWaiterCallDto } from './dto/create-waiter-call.dto';
import { ListWaiterCallsDto } from './dto/list-waiter-calls.dto';
import { WaiterCallsService } from './waiter-calls.service';

@Controller('waiter-calls')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER, APP_ROLES.WAITER)
export class WaiterCallsController {
  constructor(
    private readonly waiterCallsService: WaiterCallsService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get()
  async list(@Query() query: ListWaiterCallsDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.waiterCallsService.list(branchId, query);
  }

  @Post()
  create(@Body() dto: CreateWaiterCallDto, @CurrentUser() user: AuthUser) {
    return this.waiterCallsService.create(user.branchId, user, dto);
  }

  @Patch(':id/resolve')
  resolve(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.waiterCallsService.resolve(user.branchId, user, id);
  }
}
