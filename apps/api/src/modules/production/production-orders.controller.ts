import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { ProductionService } from './production.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
export class ProductionOrdersController {
  constructor(private readonly productionService: ProductionService) {}

  @Post(':id/send')
  send(@Param('id', ParseCuidPipe) orderId: string, @CurrentUser() user: AuthUser) {
    return this.productionService.sendOrderToStation(user.branchId, user, orderId);
  }

  @Post(':id/send-to-station')
  sendToStation(@Param('id', ParseCuidPipe) orderId: string, @CurrentUser() user: AuthUser) {
    return this.productionService.sendOrderToStation(user.branchId, user, orderId);
  }
}
