import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProductStationRouteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  stationId!: string;
}
