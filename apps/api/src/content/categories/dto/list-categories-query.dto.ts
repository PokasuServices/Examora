import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import { PaginationQueryDto } from "../../../common/dto/pagination-query.dto";

export class ListCategoriesQueryDto extends PaginationQueryDto {
  // Accepted as an explicit "true"/"false" string rather than a boolean: the
  // global ValidationPipe's enableImplicitConversion coerces the query string
  // "false" to a truthy boolean, which silently inverted this filter. Parsing
  // the string ourselves (in the controller) avoids that footgun.
  @ApiPropertyOptional({ enum: ["true", "false"], description: "Filter by active flag" })
  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: "true" | "false";
}
