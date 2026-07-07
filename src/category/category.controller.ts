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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
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
  @ApiOperation({ summary: 'Get all categories (global + user)' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async getCategoriesForUser(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.Category[]> {
    return this.categoryService.getCategoriesForUser(req.user.userId);
  }

  @Get('user-specific')
  @ApiOperation({ summary: 'Get user-specific categories' })
  @ApiResponse({ status: 200, description: 'List of user-specific categories' })
  async getUserSpecificCategories(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.Category[]> {
    return this.categoryService.getUserSpecificCategories(req.user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a category for the user' })
  @ApiResponse({ status: 201, description: 'Category created' })
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
  @ApiResponse({ status: 200, description: 'Category updated' })
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
  @ApiOperation({ summary: 'Delete a user category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  async deleteUserCategory(
    @Request() req: types.AuthenticatedRequest,
    @Param('id') categoryId: string,
  ): Promise<types.Category> {
    return this.categoryService.deleteUserCategory(req.user.userId, categoryId);
  }
}
