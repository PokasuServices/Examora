import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListForumsQueryDto extends PaginationQueryDto {
  // Explicit "true"/"false" string, not @IsBoolean() — the global ValidationPipe's
  // enableImplicitConversion coerces the query string "false" to a truthy
  // boolean (see TD-R03); parsing it ourselves in the controller avoids that.
  @ApiPropertyOptional({ enum: ["true", "false"], description: "Filter by active flag" })
  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: "true" | "false";

  // Declared here (rather than extracted via a separate @Query("categoryId"))
  // because the global ValidationPipe's forbidNonWhitelisted rejects any
  // query param not declared on the DTO bound by a bare @Query() parameter —
  // a second, separately-keyed @Query() in the same handler does not exempt
  // it from that whitelist check.
  @ApiPropertyOptional({ description: "Filter boards by category" })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
