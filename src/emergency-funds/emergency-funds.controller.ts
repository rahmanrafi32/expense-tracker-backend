import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { EmergencyService } from './emergency-funds.service';
import { CreateEmergencyFundsDto } from './dto/create-emergency-fund.dto';

@Controller('emergency')
@ApiTags('Emergency Fund')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post()
  @ApiOperation({ summary: 'Log a withdrawal or repayment' })
  @ApiResponse({ status: 201, description: 'Entry created' })
  create(@Body() dto: CreateEmergencyFundsDto) {
    return this.emergencyService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all emergency entries for a book (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated entries newest first' })
  findAll(
    @Query('bookId') bookId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.emergencyService.findAllByBook(
      bookId,
      cursor,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get emergency fund summary — borrowed, repaid, net owed',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary totals and last withdrawal',
  })
  getSummary(@Query('bookId') bookId: string) {
    return this.emergencyService.getSummary(bookId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an emergency entry' })
  remove(@Param('id') id: string) {
    return this.emergencyService.remove(id);
  }
}
