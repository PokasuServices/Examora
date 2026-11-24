import { Module } from "@nestjs/common";
import { AdminCollegesController, CollegesController } from "./colleges.controller";
import { CollegesService } from "./colleges.service";

/** Explore Colleges and webinars (student module redesign, phase 8). */
@Module({
  controllers: [CollegesController, AdminCollegesController],
  providers: [CollegesService],
  exports: [CollegesService],
})
export class CollegesModule {}
