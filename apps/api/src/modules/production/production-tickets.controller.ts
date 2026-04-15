import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ListProductionTicketsDto } from './dto/list-production-tickets.dto';
import { ProductionService } from './production.service';

@Controller('production-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
export class ProductionTicketsController {
  constructor(private readonly productionService: ProductionService) {}

  @Get()
  findAll(@Query() query: ListProductionTicketsDto, @CurrentUser() user: AuthUser) {
    return this.productionService.listProductionTickets(user.branchId, query);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productionService.getProductionTicketById(user.branchId, id);
  }
}
