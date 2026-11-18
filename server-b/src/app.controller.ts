import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("System")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: "Welcome message" })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  @ApiOperation({ summary: "Service health check" })
  @ApiResponse({ status: 200, description: "Service health status" })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get("api/v1/auth/status")
  @ApiOperation({ summary: "Backend gateway status for App A" })
  getStatus() {
    return this.appService.getStatus();
  }
}
