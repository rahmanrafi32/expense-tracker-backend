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
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from '@nestjs/passport';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Controller('categories')
@UseGuards(AuthGuard('jwt'))
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async getCategoriesForUser(
    @Request() req: AuthenticatedRequest,
  ): Promise<Category[]> {
    return this.categoryService.getCategoriesForUser(req.user.userId);
  }

  @Get('user-specific')
  async getUserSpecificCategories(
    @Request() req: AuthenticatedRequest,
  ): Promise<Category[]> {
    return this.categoryService.getUserSpecificCategories(req.user.userId);
  }

  @Post()
  async createUserCategory(
    @Request() req: AuthenticatedRequest,
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.createUserCategory(
      req.user.userId,
      createCategoryDto,
    );
  }

  @Put(':id')
  async updateUserCategory(
    @Request() req: AuthenticatedRequest,
    @Param('id') categoryId: string,
    @Body() updateData: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoryService.updateUserCategory(
      req.user.userId,
      categoryId,
      updateData,
    );
  }

  @Delete(':id')
  async deleteUserCategory(
    @Request() req: AuthenticatedRequest,
    @Param('id') categoryId: string,
  ): Promise<Category> {
    return this.categoryService.deleteUserCategory(req.user.userId, categoryId);
  }
}
