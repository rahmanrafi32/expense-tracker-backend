import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { AllocationService } from './allocation.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { type AuthenticatedRequest } from '../common';

@Controller('allocations')
@ApiTags('Allocations')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  @Post()
  @ApiOperation({ summary: 'Allocate available money' })
  @ApiResponse({
    status: 201,
    description: 'Money allocated successfully',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAllocationDto) {
    return this.allocationService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get allocation history for a book',
  })
  @ApiResponse({
    status: 200,
    description: 'List of allocation batches',
  })
  findAll(@Req() req: AuthenticatedRequest, @Query('bookId') bookId: string) {
    return this.allocationService.findAllByBook(req.user.userId, bookId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get allocation by id',
  })
  @ApiResponse({
    status: 200,
    description: 'Allocation details',
  })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.allocationService.findOne(req.user.userId, id);
  }
}
