import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ResponseCodes } from "../../common/constants/response-codes";
import { AppDefaults } from "../../common/constants/defaults";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(search?: string, first = 0, max = 50) {
    const query = this.userRepository.createQueryBuilder("u");
    if (search) {
      const q = `%${search.toLowerCase()}%`;
      query.where(
        "LOWER(u.email) LIKE :q OR LOWER(u.username) LIKE :q OR LOWER(u.displayName) LIKE :q",
        { q },
      );
    }
    query.orderBy("u.createdAt", "DESC").skip(first).take(max);
    const users = await query.getMany();
    return users.map((u) => {
      const { passwordHash, ...safe } = u;
      void passwordHash;
      return safe;
    });
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({
      where: [{ id }, { username: id }, { email: id }],
    });
    if (!user) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: `User with id or username "${id}" not found`,
      });
    }
    const { passwordHash, ...safe } = user;
    void passwordHash;
    return safe;
  }

  async create(dto: CreateUserDto) {
    const username = dto.username || dto.email.split("@")[0];
    const user = this.userRepository.create({
      email: dto.email,
      username,
      displayName:
        [dto.firstName, dto.lastName].filter(Boolean).join(" ") || username,
      passwordHash: dto.password,
      avatarUrl: AppDefaults.AVATAR.getAvatarUrl(username),
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      roles: ["user"],
    });
    const saved = await this.userRepository.save(user);
    const { passwordHash, ...safe } = saved;
    void passwordHash;
    return safe;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: [{ id }, { username: id }, { email: id }],
    });
    if (!user) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: `User with id "${id}" not found`,
      });
    }
    if (dto.firstName || dto.lastName) {
      user.displayName = [dto.firstName, dto.lastName]
        .filter(Boolean)
        .join(" ");
    }
    if (dto.email) user.email = dto.email;
    const saved = await this.userRepository.save(user);
    const { passwordHash, ...safe } = saved;
    void passwordHash;
    return safe;
  }

  async remove(id: string) {
    const user = await this.userRepository.findOne({
      where: [{ id }, { username: id }, { email: id }],
    });
    if (!user) {
      throw new NotFoundException({
        code: ResponseCodes.USER_NOT_FOUND,
        message: `User with id "${id}" not found`,
      });
    }
    await this.userRepository.delete({ id: user.id });
    return {
      message: `User ${id} removed successfully`,
    };
  }
}
