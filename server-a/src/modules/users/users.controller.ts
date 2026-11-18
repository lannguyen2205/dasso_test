import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ResponseCodes } from "../../common/constants/response-codes";

@ApiTags("Users Management")
@Controller("api/v1/users")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get current authenticated user profile" })
  @ApiResponse({
    status: 200,
    description: "Current user profile details",
  })
  async getMe(@Req() req: any) {
    const user = await this.usersService.findOne(
      req.user.id || req.user.username,
    );
    return {
      _code: ResponseCodes.PROFILE_FETCHED,
      data: {
        ...user,
        sessionId: req.user.sessionId,
        roles: req.user.roles,
      },
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "List all realm users for user management" })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "first", required: false, type: Number })
  @ApiQuery({ name: "max", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "List of users returned",
  })
  async findAll(
    @Query("search") search?: string,
    @Query("first") first?: number,
    @Query("max") max?: number,
  ) {
    const users = await this.usersService.findAll(
      search,
      first ? Number(first) : 0,
      max ? Number(max) : 50,
    );
    return {
      _code: ResponseCodes.USERS_FETCHED,
      data: users,
    };
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Get single user by ID" })
  @ApiParam({ name: "id", description: "User Keycloak UUID" })
  @ApiResponse({
    status: 200,
    description: "User details returned",
  })
  async findOne(@Param("id") id: string) {
    const user = await this.usersService.findOne(id);
    return {
      _code: ResponseCodes.PROFILE_FETCHED,
      data: user,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Create new user directly" })
  @ApiResponse({
    status: 201,
    description: "User created successfully",
  })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return {
      _code: ResponseCodes.USER_CREATED,
      data: user,
    };
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Update user profile attributes" })
  @ApiParam({ name: "id", description: "User Keycloak UUID" })
  @ApiResponse({
    status: 200,
    description: "User updated successfully",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    return {
      _code: ResponseCodes.PROFILE_UPDATED,
      data: user,
    };
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Delete user account from realm" })
  @ApiParam({ name: "id", description: "User Keycloak UUID" })
  @ApiResponse({
    status: 200,
    description: "User deleted successfully",
  })
  async remove(@Param("id") id: string) {
    const result = await this.usersService.remove(id);
    return {
      _code: ResponseCodes.USER_DELETED,
      data: result,
    };
  }
}
