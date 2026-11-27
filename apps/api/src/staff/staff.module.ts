import { Global, Module } from "@nestjs/common";
import { StaffScopeService } from "./staff-scope.service";

/** Mentor scoping, available everywhere (see StaffScopeService). */
@Global()
@Module({
  providers: [StaffScopeService],
  exports: [StaffScopeService],
})
export class StaffModule {}
