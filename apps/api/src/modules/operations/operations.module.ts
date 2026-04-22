import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { BranchesModule } from '../branches/branches.module';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';

@Module({
  imports: [PrismaModule, BranchesModule],
  controllers: [OperationsController],
  providers: [OperationsService],
})
export class OperationsModule {}
