import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { ResponseCodes } from "../constants/response-codes";

export interface StandardSuccessResponse<T> {
  success: true;
  code: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  StandardSuccessResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardSuccessResponse<T>> {
    return next.handle().pipe(
      map((result) => {
        // Pass through if the result already conforms to envelope standard
        if (
          result &&
          typeof result === "object" &&
          "success" in result &&
          "code" in result
        ) {
          return result;
        }

        // If result specifies custom response code, preserve it
        let customCode = ResponseCodes.SUCCESS;
        let responseData = result !== undefined ? result : null;

        if (
          result &&
          typeof result === "object" &&
          "_code" in result &&
          "data" in result
        ) {
          customCode = result._code;
          responseData = result.data;
        }

        return {
          success: true,
          code: customCode,
          data: responseData,
        };
      }),
    );
  }
}
