import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { normalizePermissionName, normalizeRoleName } from './domain/rbac.rules';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listRoles() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createRole(dto: CreateRoleDto, actorUserId: string) {
    const roleName = normalizeRoleName(dto.name);

    const existing = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (existing) {
      throw new BadRequestException('Role already exists');
    }

    const role = await this.prisma.role.create({
      data: {
        name: roleName,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_ROLE',
      entity: 'role',
      metadata: {
        roleId: role.id,
        roleName: role.name,
      },
    });

    return role;
  }

  async createPermission(dto: CreatePermissionDto, actorUserId: string) {
    const permissionName = normalizePermissionName(dto.name);

    const existing = await this.prisma.permission.findUnique({ where: { name: permissionName } });
    if (existing) {
      throw new BadRequestException('Permission already exists');
    }

    const permission = await this.prisma.permission.create({
      data: {
        name: permissionName,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'CREATE_PERMISSION',
      entity: 'permission',
      metadata: {
        permissionId: permission.id,
        permissionName: permission.name,
      },
    });

    return permission;
  }

  async assignRoleToUser(dto: AssignRoleDto, actorUserId: string) {
    const roleName = normalizeRoleName(dto.roleName);

    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true },
    });
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: dto.userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: dto.userId,
        roleId: role.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'ASSIGN_ROLE_TO_USER',
      entity: 'user_role',
      metadata: {
        targetUserId: dto.userId,
        roleName: role.name,
      },
    });

    return {
      message: 'Role assigned successfully',
    };
  }

  async assignPermissionToRole(dto: AssignPermissionDto, actorUserId: string) {
    const roleName = normalizeRoleName(dto.roleName);
    const permissionName = normalizePermissionName(dto.permissionName);

    const role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    const permission = await this.prisma.permission.findUnique({ where: { name: permissionName } });
    if (!permission) {
      throw new BadRequestException('Permission not found');
    }

    await this.prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'ASSIGN_PERMISSION_TO_ROLE',
      entity: 'role_permission',
      metadata: {
        roleName: role.name,
        permissionName: permission.name,
      },
    });

    return {
      message: 'Permission assigned successfully',
    };
  }
}
