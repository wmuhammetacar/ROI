import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BranchesModule } from '../branches/branches.module';
import { PrintersController } from './printers.controller';
import { PrintersService } from './printers.service';

@Module({
  imports: [PrismaModule, AuditModule, BranchesModule],
  controllers: [PrintersController],
  providers: [PrintersService],
  exports: [PrintersService],
})
export class PrintersModule {}
