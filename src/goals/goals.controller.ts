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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GoalsService } from './goals.service';
import { CreateGoal } from './dto/create-goal';
import { CreateGoalDepositDto } from './dto/create-goal-deposit';

@Controller('goals')
@ApiTags('Goals')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class GoalsController {
  constructor(private readonly goalService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a goal' })
  @ApiResponse({ status: 201, description: 'Goal created' })
  create(@Body() dto: CreateGoal) {
    return this.goalService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all goals for a book' })
  @ApiResponse({
    status: 200,
    description: 'Goals with progress, monthly needed, deposits',
  })
  findAll(@Query('bookId') bookId: string) {
    return this.goalService.findAllByBook(bookId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a goal by id' })
  findOne(@Param('id') id: string) {
    return this.goalService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a goal' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateGoal>) {
    return this.goalService.update(id, dto);
  }

  @Post(':id/deposits')
  @ApiOperation({ summary: 'Add a deposit to a goal' })
  @ApiResponse({
    status: 201,
    description: 'Deposit added, savedAmount updated',
  })
  addDeposit(@Param('id') id: string, @Body() dto: CreateGoalDepositDto) {
    return this.goalService.addDeposit(id, dto);
  }

  @Delete('deposits/:depositId')
  @ApiOperation({ summary: 'Remove a deposit (reverses savedAmount)' })
  removeDeposit(@Param('depositId') depositId: string) {
    return this.goalService.removeDeposit(depositId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a goal' })
  remove(@Param('id') id: string) {
    return this.goalService.remove(id);
  }
}
