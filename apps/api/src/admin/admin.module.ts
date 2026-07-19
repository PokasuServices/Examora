import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { AdminAuditController } from "./admin-audit.controller";
import { AdminUsersController } from "./admin-users.controller";

@Module({
  imports: [UsersModule],
  controllers: [AdminUsersController, AdminAuditController],
})
export class AdminModule {}
