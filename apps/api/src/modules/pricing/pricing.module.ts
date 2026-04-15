import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuditModule],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
