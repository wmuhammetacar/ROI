import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import type { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BranchesService } from './branches.service';

@Injectable()
export class BranchScopeResolverService {
  constructor(private readonly branchesService: BranchesService) {}

  async resolveReadBranchId(user: AuthUser, requestedBranchId?: string | null): Promise<string> {
    const normalized = requestedBranchId?.trim();

    if (!normalized) {
      return user.branchId;
    }

    if (normalized === user.branchId) {
      return user.branchId;
    }

    const isAdmin = user.roles.includes(APP_ROLES.ADMIN);
    if (!isAdmin) {
      throw new ForbiddenException('Branch override is only allowed for admin users');
    }

    const exists = await this.branchesService.exists(normalized);
    if (!exists) {
      throw new NotFoundException('Requested branch not found');
    }

    return normalized;
  }
}
