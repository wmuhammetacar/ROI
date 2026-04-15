import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBranchDto } from './dto/create-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
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

  async findAll(): Promise<Array<{ id: string; name: string; createdAt: Date; updatedAt: Date }>> {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findById(id: string): Promise<{ id: string; name: string; createdAt: Date; updatedAt: Date } | null> {
    return this.prisma.branch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async exists(branchId: string): Promise<boolean> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    return Boolean(branch);
  }
}
