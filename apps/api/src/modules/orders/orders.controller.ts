import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { AddCatalogOrderItemDto } from './dto/add-catalog-order-item.dto';
import { AddOrderItemDto } from './dto/add-order-item.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersDto } from './dto/list-orders.dto';
import { UpdateCatalogOrderItemDto } from './dto/update-catalog-order-item.dto';
import { UpdateOrderItemDto } from './dto/update-order-item.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.ordersService.create(user.branchId, user, dto);
  }

  @Get()
  async findAll(@Query() query: ListOrdersDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.ordersService.findAll(branchId, query);
  }

  @Get(':id/events')
  async findEvents(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.ordersService.findEvents(branchId, id);
  }

  @Get(':id')
  async findById(
    @Param('id', ParseCuidPipe) id: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.ordersService.findById(branchId, id);
  }

  @Post(':id/items')
  addItem(@Param('id', ParseCuidPipe) id: string, @Body() dto: AddOrderItemDto, @CurrentUser() user: AuthUser) {
    return this.ordersService.addItem(user.branchId, user, id, dto);
  }

  @Post(':id/items/catalog')
  addCatalogItem(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: AddCatalogOrderItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.addCatalogItem(user.branchId, user, id, dto);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId', ParseCuidPipe) itemId: string,
    @Body() dto: UpdateOrderItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.updateItem(user.branchId, user, id, itemId, dto);
  }

  @Patch(':id/items/:itemId/catalog')
  updateCatalogItem(
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId', ParseCuidPipe) itemId: string,
    @Body() dto: UpdateCatalogOrderItemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.updateCatalogItem(user.branchId, user, id, itemId, dto);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @Param('id', ParseCuidPipe) id: string,
    @Param('itemId', ParseCuidPipe) itemId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.removeItem(user.branchId, user, id, itemId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.ordersService.updateStatus(user.branchId, user, id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseCuidPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.ordersService.cancel(user.branchId, user, id);
  }
}
