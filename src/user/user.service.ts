import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findAll() {
    return this.prisma.user.findMany();
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
    });
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const oldProfilePic = user.profilePic;
    console.log('oldProfilePic', oldProfilePic);
    const newProfilePic = updateUserDto.profilePic;
    console.log('newProfilePic', newProfilePic);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    console.log('updatedUser', updatedUser.profilePic);

    if (oldProfilePic && newProfilePic && oldProfilePic !== newProfilePic) {
      try {
        console.log('on delete old profile pic', oldProfilePic);
        await this.cloudinaryService.deleteImage(oldProfilePic);
      } catch (error) {
        this.logger.error(
          `Failed to delete old profile image "${oldProfilePic}"`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return updatedUser;
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const profilePic = user.profilePic;

    const deletedUser = await this.prisma.user.delete({
      where: { id },
    });

    if (profilePic) {
      try {
        await this.cloudinaryService.deleteImage(profilePic);
      } catch (error) {
        this.logger.error(
          `Failed to delete profile image "${profilePic}" after deleting user "${id}"`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return deletedUser;
  }
}
