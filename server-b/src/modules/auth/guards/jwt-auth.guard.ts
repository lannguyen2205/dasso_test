import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ResponseCodes } from "../../../common/constants/response-codes";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw new UnauthorizedException({
        code: ResponseCodes.UNAUTHORIZED,
        message: "Invalid, expired, or missing JWT Bearer token",
      });
    }
    return user;
  }
}
