import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { ProductionService } from './production.service';

@Controller('stations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER, APP_ROLES.PRODUCTION)
export class StationProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Get(':id/production-tickets')
  getStationTickets(@Param('stationId', ParseCuidPipe) stationId: string, @CurrentUser() user: AuthUser) {
    return this.productionService.getStationProductionTickets(user.branchId, stationId);
  }

  @Get(':id/kds/queue')
  getKdsQueue(@Param('stationId', ParseCuidPipe) stationId: string, @CurrentUser() user: AuthUser) {
    return this.productionService.getStationKdsQueue(user.branchId, stationId);
  }

  @Get(':id/kds/summary')
  getKdsSummary(@Param('stationId', ParseCuidPipe) stationId: string, @CurrentUser() user: AuthUser) {
    return this.productionService.getStationKdsSummary(user.branchId, stationId);
  }
}
