import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { User } from "./modules/users/entities/user.entity";
import { EmailOtp } from "./modules/auth/entities/email-otp.entity";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      url: process.env.DATABASE_URL,
      schema: process.env.DB_SCHEMA || "server_a",
      entities: [User, EmailOtp],
      synchronize: true,
      ssl: { rejectUnauthorized: false },
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
