import type { Job } from "bullmq";
import { CmsAnnouncementsService } from "../announcements/cms-announcements.service";
import { CmsBannersService } from "../banners/cms-banners.service";
import { CmsFaqService } from "../faq/cms-faq.service";
import { CmsPagesService } from "../pages/cms-pages.service";
import { CmsSchedulingProcessor } from "./cms-scheduling.processor";
import type { CmsSchedulingJobData } from "./cms-scheduling.constants";

function job(data: CmsSchedulingJobData): Job<CmsSchedulingJobData> {
  return { data } as Job<CmsSchedulingJobData>;
}

describe("CmsSchedulingProcessor", () => {
  const pages = {
    findByIdOrThrow: jest.fn(),
    transition: jest.fn(),
  } as unknown as jest.Mocked<CmsPagesService>;
  const faq = {
    findByIdOrThrow: jest.fn(),
    transition: jest.fn(),
  } as unknown as jest.Mocked<CmsFaqService>;
  const announcements = {
    findByIdOrThrow: jest.fn(),
    transition: jest.fn(),
  } as unknown as jest.Mocked<CmsAnnouncementsService>;
  const banners = {
    findByIdOrThrow: jest.fn(),
    transition: jest.fn(),
  } as unknown as jest.Mocked<CmsBannersService>;
  const processor = new CmsSchedulingProcessor(pages, faq, announcements, banners);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("dispatches a PUBLISH action for a PAGE to pages.transition with the page's own author as actor", async () => {
    (pages.findByIdOrThrow as jest.Mock).mockResolvedValue({
      id: "page-1",
      createdById: "author-1",
    });
    await processor.process(job({ contentType: "PAGE", contentId: "page-1", action: "PUBLISH" }));
    expect(pages.transition).toHaveBeenCalledWith("author-1", "page-1", "PUBLISHED");
  });

  it("dispatches an UNPUBLISH action for a FAQ item to faq.transition targeting ARCHIVED", async () => {
    (faq.findByIdOrThrow as jest.Mock).mockResolvedValue({ id: "faq-1", createdById: "author-2" });
    await processor.process(job({ contentType: "FAQ", contentId: "faq-1", action: "UNPUBLISH" }));
    expect(faq.transition).toHaveBeenCalledWith("author-2", "faq-1", "ARCHIVED");
  });

  it("dispatches to the announcements service for ANNOUNCEMENT content", async () => {
    (announcements.findByIdOrThrow as jest.Mock).mockResolvedValue({
      id: "ann-1",
      createdById: "author-3",
    });
    await processor.process(
      job({ contentType: "ANNOUNCEMENT", contentId: "ann-1", action: "PUBLISH" }),
    );
    expect(announcements.transition).toHaveBeenCalledWith("author-3", "ann-1", "PUBLISHED");
    expect(pages.transition).not.toHaveBeenCalled();
  });

  it("dispatches to the banners service for BANNER content", async () => {
    (banners.findByIdOrThrow as jest.Mock).mockResolvedValue({
      id: "banner-1",
      createdById: "author-4",
    });
    await processor.process(
      job({ contentType: "BANNER", contentId: "banner-1", action: "UNPUBLISH" }),
    );
    expect(banners.transition).toHaveBeenCalledWith("author-4", "banner-1", "ARCHIVED");
  });
});
