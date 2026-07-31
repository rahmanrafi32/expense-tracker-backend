import { PartialType } from '@nestjs/swagger';
import { CreateEmergencyFundsDto } from './create-emergency-fund.dto';

export class UpdateEmergencyFundDto extends PartialType(
  CreateEmergencyFundsDto,
) {}
