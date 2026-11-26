import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import type { Response } from "express";
import type { StudyMediaAsset } from "@examora/types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { RequirePermissions } from "../common/decorators/require-permissions.decorator";
import type { RequestUser } from "../auth/types/request-user";
import { ConfirmStudyMediaDto, PresignStudyMediaDto } from "./dto/study-media.dto";
import { StudyMediaService } from "./study-media.service";

@ApiTags("study media")
@Controller()
export class StudyMediaController {
  constructor(private readonly media: StudyMediaService) {}

  @Post("admin/content/media/presign")
  @RequirePermissions("content:manage")
  @ApiOperation({ summary: "Presigned upload URL for a question/lesson image or video" })
  presign(@Body() dto: PresignStudyMediaDto) {
    return this.media.presign(dto);
  }

  @Post("admin/content/media/confirm")
  @RequirePermissions("content:manage")
  @ApiOperation({
    summary: "Register an uploaded file; images are virus-scanned before they are served",
  })
  confirm(
    @CurrentUser() actor: RequestUser,
    @Body() dto: ConfirmStudyMediaDto,
  ): Promise<StudyMediaAsset> {
    return this.media.confirm(actor.id, dto);
  }

  @Get("admin/content/media/:id")
  @RequirePermissions("content:manage")
  @ApiOperation({ summary: "Upload status (poll until scanStatus is CLEAN)" })
  get(@Param("id", ParseUUIDPipe) id: string): Promise<StudyMediaAsset> {
    return this.media.get(id);
  }

  /**
   * Public so <img>/<video> tags can load it (they can't send a bearer
   * token). Ids are unguessable UUIDs and only CLEAN files are served, via a
   * short-lived presigned storage URL.
   */
  @Get("media/:id")
  @Public()
  @SkipThrottle()
  @ApiOperation({ summary: "Redirect to an uploaded study image/video" })
  async serve(@Param("id", ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const url = await this.media.getPublicUrl(id);
    // Shorter than the presigned URL's 5-minute life, so a cached redirect never points at an expired URL.
    res.setHeader("Cache-Control", "private, max-age=240");
    // helmet() defaults every response to CORP "same-origin", which makes browsers
    // refuse this redirect when the web/admin apps (another origin) embed it in
    // <img>/<video>. These files are meant to be embedded, so allow it here only.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.redirect(302, url);
  }
}
