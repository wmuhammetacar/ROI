import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseCuidPipe } from '../../common/pipes/parse-cuid.pipe';
import { CreateProductStationRouteDto } from './dto/create-product-station-route.dto';
import { UpdateProductStationRouteDto } from './dto/update-product-station-route.dto';
import { StationsService } from './stations.service';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN)
export class ProductStationRoutesController {
  constructor(private readonly stationsService: StationsService) {}

  @Post(':id/station-route')
  create(
    @Param('id', ParseCuidPipe) productId: string,
    @Body() dto: CreateProductStationRouteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stationsService.createProductRoute(user.branchId, productId, user.sub, dto);
  }

  @Get(':id/station-route')
  findByProduct(@Param('id', ParseCuidPipe) productId: string, @CurrentUser() user: AuthUser) {
    return this.stationsService.getProductRoute(user.branchId, productId);
  }

  @Patch(':id/station-route')
  update(
    @Param('id', ParseCuidPipe) productId: string,
    @Body() dto: UpdateProductStationRouteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stationsService.updateProductRoute(user.branchId, productId, user.sub, dto);
  }

  @Delete(':id/station-route')
  remove(@Param('id', ParseCuidPipe) productId: string, @CurrentUser() user: AuthUser) {
    return this.stationsService.deleteProductRoute(user.branchId, productId, user.sub);
  }
}
