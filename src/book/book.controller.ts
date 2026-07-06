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
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { BookService } from './book.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { AuthGuard } from '@nestjs/passport';
@Controller('books')
@ApiTags('Books')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class BookController {
  constructor(private readonly bookService: BookService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a book' })
  @ApiResponse({ status: 201, description: 'Book created' })
  create(@Body() createBookDto: CreateBookDto) {
    return this.bookService.create(createBookDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get books for a user' })
  @ApiResponse({ status: 200, description: 'List of books' })
  findAll(@Query('userId') userId: string) {
    return this.bookService.findAllByUser(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a book by id' })
  @ApiResponse({ status: 200, description: 'Book details' })
  findOne(@Param('id') id: string) {
    return this.bookService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a book' })
  @ApiResponse({ status: 200, description: 'Updated book' })
  update(@Param('id') id: string, @Body() updateBookDto: UpdateBookDto, @Request() req: any) {
    const userId = req.user?.id;
    return this.bookService.update(id, updateBookDto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a book' })
  @ApiResponse({ status: 200, description: 'Deleted book' })
  remove(@Param('id') id: string, @Request() req: any) {
    const userId = req.user?.id;
    return this.bookService.remove(id, userId);
  }
}
