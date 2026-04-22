import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { RepeatCustomerOrderDto } from './dto/repeat-order.dto';
import { StartCustomerOrderDto } from './dto/start-customer-order.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomersService } from './customers.service';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get()
  async list(@Query() query: ListCustomersDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.customersService.list(branchId, query);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customersService.create(user.branchId, user, dto);
  }

  @Get(':id')
  async getById(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.customersService.findById(branchId, id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.update(user.branchId, id, user, dto);
  }

  @Get(':id/orders')
  async orderHistory(
    @Param('id', ParseCuidPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.getOrderHistory(user.branchId, id);
  }

  @Post(':id/start-order')
  startOrder(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: StartCustomerOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.startPackageOrder(user.branchId, id, user, dto);
  }

  @Post(':id/repeat-order/:orderId')
  repeatOrder(
    @Param('id', ParseCuidPipe) id: string,
    @Param('orderId', ParseCuidPipe) orderId: string,
    @Body() dto: RepeatCustomerOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.customersService.repeatOrder(user.branchId, id, orderId, user, dto);
  }
}
