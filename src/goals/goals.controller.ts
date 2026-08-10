import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal';
import { UpdateGoalDto } from './dto/update-goal';
import { CreateGoalDepositDto } from './dto/create-goal-deposit';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('goals')
@ApiTags('Goals')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a goal',
  })
  @ApiResponse({
    status: 201,
    description: 'Goal created successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Book not found',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all goals for a book',
  })
  @ApiQuery({
    name: 'bookId',
    required: true,
    type: String,
    description: 'Book UUID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Goals with progress, remaining amount, monthly requirement, and deposits',
  })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('bookId', new ParseUUIDPipe()) bookId: string,
  ) {
    return this.goalsService.findAllByBook(req.user.userId, bookId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a goal by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Goal found',
  })
  @ApiResponse({
    status: 404,
    description: 'Goal not found',
  })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.goalsService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a goal',
  })
  @ApiResponse({
    status: 200,
    description: 'Goal updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid update, including target below saved amount',
  })
  @ApiResponse({
    status: 404,
    description: 'Goal not found',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(req.user.userId, id, dto);
  }

  @Post(':id/deposits')
  @ApiOperation({
    summary: 'Add a deposit to a goal',
  })
  @ApiResponse({
    status: 201,
    description: 'Deposit added and saved amount updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Deposit would exceed the goal target',
  })
  @ApiResponse({
    status: 404,
    description: 'Goal not found',
  })
  addDeposit(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateGoalDepositDto,
  ) {
    return this.goalsService.addDeposit(req.user.userId, id, dto);
  }

  @Delete('deposits/:depositId')
  @ApiOperation({
    summary: 'Remove a goal deposit',
  })
  @ApiResponse({
    status: 200,
    description: 'Deposit removed and saved amount reversed',
  })
  @ApiResponse({
    status: 404,
    description: 'Deposit not found',
  })
  removeDeposit(
    @Req() req: AuthenticatedRequest,
    @Param('depositId', new ParseUUIDPipe())
    depositId: string,
  ) {
    return this.goalsService.removeDeposit(req.user.userId, depositId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a goal',
  })
  @ApiResponse({
    status: 200,
    description: 'Goal deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Goal not found',
  })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.goalsService.remove(req.user.userId, id);
  }
}
