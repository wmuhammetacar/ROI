import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProductStationRouteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stationId!: string;
}
