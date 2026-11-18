import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { ResponseCodes } from "../constants/response-codes";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (!response || typeof response.status !== "function") {
      this.logger.error("Unhandled non-HTTP exception", exception);
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ResponseCodes.SERVER_ERROR;
    let message = "An unexpected internal server error occurred";
    let details: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
        code = this.resolveCodeFromStatus(status);
      } else if (typeof res === "object" && res !== null) {
        const errorObj = res as Record<string, any>;
        message = errorObj.message || exception.message;
        code = errorObj.code || this.resolveCodeFromStatus(status);
        details = errorObj.details || errorObj.error || null;
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `Internal error: ${exception.message}`,
        exception.stack,
      );
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message,
        details,
      },
    });
  }

  private resolveCodeFromStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ResponseCodes.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ResponseCodes.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ResponseCodes.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ResponseCodes.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ResponseCodes.USER_ALREADY_EXISTS;
      default:
        return ResponseCodes.SERVER_ERROR;
    }
  }
}
