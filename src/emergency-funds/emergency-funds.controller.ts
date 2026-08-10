import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
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
import { type AuthenticatedRequest } from '../common';

@Controller('emergency')
@ApiTags('Emergency Fund')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class EmergencyController {
  constructor(private readonly emergencyService: EmergencyService) {}

  @Post()
  @ApiOperation({ summary: 'Log a withdrawal or repayment' })
  @ApiResponse({ status: 201, description: 'Entry created' })
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateEmergencyFundsDto,
  ) {
    return this.emergencyService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all emergency entries for a book (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated entries newest first' })
  findAll(
    @Request() req: AuthenticatedRequest,
    @Query('bookId') bookId: string,
    @Query('cursor') cursor: string = '',
    @Query('limit') limit?: string,
  ) {
    return this.emergencyService.findAllByBook(
      req.user.userId,
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
  getSummary(
    @Request() req: AuthenticatedRequest,
    @Query('bookId') bookId: string,
  ) {
    return this.emergencyService.getSummary(req.user.userId, bookId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an emergency entry' })
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.emergencyService.remove(req.user.userId, id);
  }
}
