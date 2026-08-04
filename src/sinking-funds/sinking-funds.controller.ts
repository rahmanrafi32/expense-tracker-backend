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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SinkingFundService } from './sinking-funds.service';
import { CreateSinkingFundDto } from './dto/create-sinking-fund.dto';
import { UpdateSinkingFundDto } from './dto/update-sinking-fund.dto';
import { CreateSinkingFundDepositDto } from './dto/create-sinking-fund-deposit.dto';

@Controller('sinking-funds')
@ApiTags('Sinking Funds')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class SinkingFundController {
  constructor(private readonly sinkingFundService: SinkingFundService) {}

  @Post()
  @ApiOperation({ summary: 'Create a sinking fund' })
  create(@Body() dto: CreateSinkingFundDto) {
    return this.sinkingFundService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all sinking funds for a book' })
  findAll(@Query('bookId') bookId: string) {
    return this.sinkingFundService.findAllByBook(bookId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a sinking fund by id' })
  findOne(@Param('id') id: string) {
    return this.sinkingFundService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a sinking fund' })
  update(@Param('id') id: string, @Body() dto: UpdateSinkingFundDto) {
    return this.sinkingFundService.update(id, dto);
  }

  @Post(':id/deposits')
  @ApiOperation({ summary: 'Add a deposit to a sinking fund' })
  addDeposit(
    @Param('id') id: string,
    @Body() dto: CreateSinkingFundDepositDto,
  ) {
    return this.sinkingFundService.addDeposit(id, dto);
  }

  @Delete('deposits/:depositId')
  @ApiOperation({ summary: 'Remove a deposit from a sinking fund' })
  removeDeposit(@Param('depositId') depositId: string) {
    return this.sinkingFundService.removeDeposit(depositId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a sinking fund' })
  remove(@Param('id') id: string) {
    return this.sinkingFundService.remove(id);
  }
}
