import { IsString } from 'class-validator';

export class AssignPermissionDto {
  @IsString()
  roleName!: string;

  @IsString()
  permissionName!: string;
}
