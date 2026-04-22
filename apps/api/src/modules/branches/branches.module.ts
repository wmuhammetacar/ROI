import { Module } from '@nestjs/common';
import { NetworkPolicyService } from '../../common/network/network-policy.service';
import { AuditModule } from '../audit/audit.module';
import { BranchScopeResolverService } from './branch-scope-resolver.service';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [AuditModule],
  controllers: [BranchesController],
  providers: [BranchesService, BranchScopeResolverService, NetworkPolicyService],
  exports: [BranchesService, BranchScopeResolverService],
})
export class BranchesModule {}
