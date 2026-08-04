import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from '@nestjs/passport';
import * as types from '../common';

@Controller('categories')
@ApiTags('Categories')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all categories (system + default + user)' })
  @ApiResponse({
    status: 200,
    description: 'List of categories',
  })
  async getCategoriesForUser(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.Category[]> {
    return this.categoryService.getCategoriesForUser(req.user.userId);
  }

  @Get('user-specific')
  @ApiOperation({ summary: 'Get user-specific categories only' })
  @ApiResponse({
    status: 200,
    description: 'List of user-specific categories',
  })
  async getUserSpecificCategories(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.Category[]> {
    return this.categoryService.getUserSpecificCategories(req.user.userId);
  }

  @Get('default')
  @ApiOperation({ summary: 'Get default categories (shared across users)' })
  @ApiResponse({
    status: 200,
    description: 'List of default categories',
  })
  async getDefaultCategories(): Promise<types.Category[]> {
    return this.categoryService.getDefaultCategories();
  }

  @Get('system')
  @ApiOperation({ summary: 'Get system categories (read-only)' })
  @ApiResponse({
    status: 200,
    description: 'List of system categories',
  })
  async getSystemCategories(): Promise<types.Category[]> {
    return this.categoryService.getSystemCategories();
  }

  @Post()
  @ApiOperation({ summary: 'Create a category for the user' })
  @ApiResponse({
    status: 201,
    description: 'Category created',
  })
  @ApiResponse({
    status: 409,
    description: 'Category with this name already exists',
  })
  async createUserCategory(
    @Request() req: types.AuthenticatedRequest,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<types.Category> {
    return this.categoryService.createUserCategory(
      req.user.userId,
      createCategoryDto,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({
    status: 200,
    description: 'Category updated',
  })
  @ApiResponse({
    status: 404,
    description: 'Category not found or cannot be updated',
  })
  @ApiResponse({
    status: 409,
    description: 'Category with this name already exists',
  })
  async updateUserCategory(
    @Request() req: types.AuthenticatedRequest,
    @Param('id') categoryId: string,
    @Body() updateData: UpdateCategoryDto,
  ): Promise<types.Category> {
    return this.categoryService.updateUserCategory(
      req.user.userId,
      categoryId,
      updateData,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 204, description: 'Category deleted' })
  @ApiResponse({
    status: 404,
    description: 'Category not found or cannot be deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete category used in transactions',
  })
  async deleteUserCategory(
    @Request() req: types.AuthenticatedRequest,
    @Param('id') categoryId: string,
  ): Promise<void> {
    await this.categoryService.deleteUserCategory(req.user.userId, categoryId);
  }

  @Get('system-expenses')
  @ApiOperation({
    summary: 'Get categories suitable for expenses/sinking funds',
  })
  getExpenseCategories() {
    return this.categoryService.getExpenseCategories();
  }
}
