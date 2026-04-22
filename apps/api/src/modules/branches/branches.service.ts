import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NetworkPolicyService } from '../../common/network/network-policy.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchNetworkSettingsDto } from './dto/update-branch-network-settings.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly networkPolicyService: NetworkPolicyService,
  ) {}

  async create(dto: CreateBranchDto, actorUserId: string): Promise<{ id: string; name: string }> {
    const existing = await this.prisma.branch.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new BadRequestException('Branch name already exists');
    }

    const branch = await this.prisma.branch.create({
      data: {
        name: dto.name,
      },
      select: {
        id: true,
        name: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_BRANCH',
      entity: 'branch',
      metadata: { branchId: branch.id },
    });

    return branch;
  }

  async findAll(): Promise<Array<{ id: string; name: string; allowedNetworkCidrs: string[]; createdAt: Date; updatedAt: Date }>> {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        allowedNetworkCidrs: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findById(id: string): Promise<{ id: string; name: string; allowedNetworkCidrs: string[]; createdAt: Date; updatedAt: Date } | null> {
    return this.prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        allowedNetworkCidrs: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateNetworkSettings(id: string, dto: UpdateBranchNetworkSettingsDto, actorUserId: string) {
    const exists = await this.exists(id);
    if (!exists) {
      throw new BadRequestException('Branch not found');
    }

    const normalizedCidrs = this.networkPolicyService.validateAndNormalizeCidrs(
      dto.allowedNetworkCidrs ?? [],
    );

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        allowedNetworkCidrs: normalizedCidrs,
      },
      select: {
        id: true,
        name: true,
        allowedNetworkCidrs: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'UPDATE_BRANCH_NETWORK_SETTINGS',
      entity: 'branch',
      metadata: {
        branchId: id,
        allowedNetworkCidrs: normalizedCidrs,
      },
    });

    return updated;
  }

  async exists(branchId: string): Promise<boolean> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    return Boolean(branch);
  }
}
