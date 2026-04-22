import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { APP_ROLES } from '../../common/constants/roles';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { passwordHasher } from '../../common/utils/password-hasher';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchesService } from '../branches/branches.service';
import { enforcePasswordPolicy } from '../auth/domain/password.policy';
import { CreateUserDto } from './dto/create-user.dto';
import { enforceBranchMembership, normalizeRoleNames } from './domain/user.rules';

const USER_AUTH_INCLUDE = {
  branch: true,
  userRoles: {
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

export type UserWithAuthContext = Prisma.UserGetPayload<{ include: typeof USER_AUTH_INCLUDE }>;

@Injectable()
export class UsersService {
  private readonly saltRounds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly branchesService: BranchesService,
    private readonly auditService: AuditService,
  ) {
    this.saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS', 12));
  }

  async createUser(dto: CreateUserDto, actorUserId?: string) {
    enforceBranchMembership(dto.branchId);

    const hasPassword = Boolean(dto.password?.trim());
    const hasPin = Boolean(dto.pin?.trim());
    if (!hasPassword && !hasPin) {
      throw new BadRequestException('Either password or PIN is required');
    }

    if (hasPassword) {
      enforcePasswordPolicy(dto.password!);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const branchExists = await this.branchesService.exists(dto.branchId);
    if (!branchExists) {
      throw new BadRequestException('Branch not found');
    }

    const username = (dto.username?.trim() || dto.email.split('@')[0]).toLowerCase();
    const existingUsername = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existingUsername) {
      throw new BadRequestException('Username already exists');
    }

    const roleNames = normalizeRoleNames(dto.roleNames, [APP_ROLES.CASHIER]);
    const roles = await this.prisma.role.findMany({
      where: {
        name: {
          in: roleNames,
        },
      },
    });

    if (roles.length !== roleNames.length) {
      const foundRoleNames = roles.map((role) => role.name);
      const missingRoles = roleNames.filter((roleName) => !foundRoleNames.includes(roleName));
      throw new BadRequestException(`Unknown roles: ${missingRoles.join(', ')}`);
    }

    const hashedPassword = hasPassword ? await passwordHasher.hash(dto.password!, this.saltRounds) : null;
    const pinHash = hasPin ? await passwordHasher.hash(dto.pin!, this.saltRounds) : null;

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name,
          username,
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          pinHash,
          isActive: dto.isActive ?? true,
          branchId: dto.branchId,
        },
      });

      await tx.userRole.createMany({
        data: roles.map((role) => ({
          userId: createdUser.id,
          roleId: role.id,
        })),
      });

      return tx.user.findUniqueOrThrow({
        where: { id: createdUser.id },
        include: USER_AUTH_INCLUDE,
      });
    });

    await this.auditService.logAction({
      userId: actorUserId ?? user.id,
      action: actorUserId ? 'CREATE_USER' : 'REGISTER_USER',
      entity: 'user',
      metadata: {
        createdUserId: user.id,
        branchId: user.branchId,
        roles: roleNames,
      },
    });

    return this.toPublicUser(user);
  }

  async findByEmailForAuth(email: string): Promise<UserWithAuthContext | null> {
    return this.prisma.user.findUnique({
      where: {
        email: email.toLowerCase(),
      },
      include: USER_AUTH_INCLUDE,
    });
  }

  async findByUsernameForAuth(username: string): Promise<UserWithAuthContext | null> {
    return this.prisma.user.findUnique({
      where: {
        username: username.toLowerCase(),
      },
      include: USER_AUTH_INCLUDE,
    });
  }

  async findStaff(branchId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        branchId: branchId || undefined,
      },
      include: USER_AUTH_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
    return users.map((user) => this.toPublicUser(user));
  }

  async setActiveState(userId: string, isActive: boolean, actorUserId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
      include: USER_AUTH_INCLUDE,
    });

    await this.auditService.logAction({
      userId: actorUserId,
      action: 'SET_USER_ACTIVE_STATE',
      entity: 'user',
      metadata: {
        targetUserId: user.id,
        isActive,
      },
    });

    return this.toPublicUser(user);
  }

  async findByIdForAuth(userId: string): Promise<UserWithAuthContext | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_AUTH_INCLUDE,
    });
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      include: USER_AUTH_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => this.toPublicUser(user));
  }

  async findPublicById(userId: string) {
    const user = await this.findByIdForAuth(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    return this.toPublicUser(user);
  }

  toAuthPayload(user: UserWithAuthContext): AuthUser {
    const roles = user.userRoles.map((userRole) => userRole.role.name);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.rolePermissions.map((rolePermission) => rolePermission.permission.name),
        ),
      ),
    );

    return {
      sub: user.id,
      email: user.email,
      branchId: user.branchId,
      roles,
      permissions,
    };
  }

  toPublicUser(user: UserWithAuthContext) {
    const authPayload = this.toAuthPayload(user);

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      branchId: user.branchId,
      branchName: user.branch.name,
      isActive: user.isActive,
      roles: authPayload.roles,
      permissions: authPayload.permissions,
      createdAt: user.createdAt,
    };
  }
}
