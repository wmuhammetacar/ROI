import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { UpdateProductionTicketItemStatusDto } from './dto/update-production-ticket-item-status.dto';
import { ProductionService } from './production.service';

@Controller('production-ticket-items')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER, APP_ROLES.PRODUCTION)
export class ProductionTicketItemsController {
  constructor(private readonly productionService: ProductionService) {}

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateProductionTicketItemStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productionService.updateProductionTicketItemStatus(user.branchId, user, id, dto);
  }
}
