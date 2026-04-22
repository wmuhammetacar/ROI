import { IsOptional } from 'class-validator';
import { IsCuid } from '../../../common/validators/is-cuid.decorator';

export class PreviewPrinterRouteDto {
  @IsOptional()
  @IsCuid()
  productId?: string;

  @IsOptional()
  @IsCuid()
  stationId?: string;
}
