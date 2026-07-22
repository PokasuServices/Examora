import { PartialType } from "@nestjs/swagger";
import { CreateForumBoardDto } from "./create-forum-board.dto";

export class UpdateForumBoardDto extends PartialType(CreateForumBoardDto) {}
