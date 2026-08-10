import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SinkingFundService } from './sinking-funds.service';
import { CreateSinkingFundDto } from './dto/create-sinking-fund.dto';
import { UpdateSinkingFundDto } from './dto/update-sinking-fund.dto';
import { CreateSinkingFundDepositDto } from './dto/create-sinking-fund-deposit.dto';
import { type AuthenticatedRequest } from '../common';

@Controller('sinking-funds')
@ApiTags('Sinking Funds')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class SinkingFundController {
  constructor(private readonly sinkingFundService: SinkingFundService) {}

  @Post()
  @ApiOperation({ summary: 'Create a sinking fund' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSinkingFundDto) {
    return this.sinkingFundService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sinking funds for a book' })
  findAll(@Req() req: AuthenticatedRequest, @Query('bookId') bookId: string) {
    return this.sinkingFundService.findAllByBook(req.user.userId, bookId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sinking fund by id' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sinkingFundService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a sinking fund' })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSinkingFundDto,
  ) {
    return this.sinkingFundService.update(req.user.userId, id, dto);
  }

  @Post(':id/deposits')
  @ApiOperation({ summary: 'Add a deposit to a sinking fund' })
  addDeposit(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateSinkingFundDepositDto,
  ) {
    return this.sinkingFundService.addDeposit(req.user.userId, id, dto);
  }

  @Delete('deposits/:depositId')
  @ApiOperation({ summary: 'Remove a deposit from a sinking fund' })
  removeDeposit(
    @Req() req: AuthenticatedRequest,
    @Param('depositId') depositId: string,
  ) {
    return this.sinkingFundService.removeDeposit(req.user.userId, depositId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sinking fund' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.sinkingFundService.remove(req.user.userId, id);
  }
}
