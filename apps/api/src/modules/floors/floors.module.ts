import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { FloorsController } from './floors.controller';
import { FloorsService } from './floors.service';

@Module({
  imports: [AuditModule],
  controllers: [FloorsController],
  providers: [FloorsService],
  exports: [FloorsService],
})
export class FloorsModule {}
