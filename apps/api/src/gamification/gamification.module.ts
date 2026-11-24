import { Module } from "@nestjs/common";
import { XpController } from "./xp.controller";
import { XpService } from "./xp.service";

/** Student XP and rewards (student module redesign). Exports XpService so other modules can award XP. */
@Module({
  controllers: [XpController],
  providers: [XpService],
  exports: [XpService],
})
export class GamificationModule {}
