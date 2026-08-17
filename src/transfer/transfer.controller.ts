import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { TransferService } from './transfer.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { type AuthenticatedRequest } from '../common';

@Controller('transfers')
@ApiTags('Transfers')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transfer' })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTransferDto) {
    return this.transferService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transfers' })
  findAll(@Req() req: AuthenticatedRequest, @Query('bookId') bookId?: string) {
    return this.transferService.findAll(req.user.userId, bookId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transfer by id' })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.transferService.findOne(req.user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transfer' })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.transferService.remove(req.user.userId, id);
  }
}
