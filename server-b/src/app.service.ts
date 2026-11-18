import { Injectable } from "@nestjs/common";
import { AppDefaults } from "./common/constants/defaults";

@Injectable()
export class AppService {
  getHello(): string {
    return `${AppDefaults.APP.NAME} is running smoothly!`;
  }

  getHealth() {
    return {
      status: "healthy",
      service: AppDefaults.APP.SERVICE_ID,
      appName: AppDefaults.APP.NAME,
      timestamp: new Date().toISOString(),
    };
  }

  getStatus() {
    return {
      service: AppDefaults.APP.NAME,
      serviceId: AppDefaults.APP.SERVICE_ID,
      status: "active",
      authMethods: ["email_otp_verification", "password_login", "jwt_bearer"],
      port: process.env.PORT ?? AppDefaults.APP.PORT,
      timestamp: new Date().toISOString(),
    };
  }
}
