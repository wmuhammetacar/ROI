import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProductStationRoutesController } from './product-station-routes.controller';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [AuditModule],
  controllers: [StationsController, ProductStationRoutesController],
  providers: [StationsService],
  exports: [StationsService],
})
export class StationsModule {}
