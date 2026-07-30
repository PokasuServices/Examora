import type { Job } from "bullmq";
import type { NotificationScheduleJobData } from "./notification.constants";
import { NotificationScheduleProcessor } from "./notification-schedule.processor";
import type { NotificationsService } from "./notifications.service";

describe("NotificationScheduleProcessor", () => {
  it("creates the notification (via NotificationsService.enqueue) only once the delayed job fires", async () => {
    const enqueue = jest.fn(async () => ({}) as never);
    const notificationsService = { enqueue } as unknown as NotificationsService;
    const processor = new NotificationScheduleProcessor(notificationsService);

    const data: NotificationScheduleJobData = {
      userId: "user-1",
      eventType: "assignment.due_reminder",
      category: "assignments",
      title: "Assignment due soon",
      body: '"Essay 1" is due in 24 hours.',
      data: { assignmentId: "assignment-1" },
      channels: ["EMAIL"],
    };

    await processor.process({ data } as Job<NotificationScheduleJobData>);

    expect(enqueue).toHaveBeenCalledWith({
      userId: "user-1",
      eventType: "assignment.due_reminder",
      category: "assignments",
      title: "Assignment due soon",
      body: '"Essay 1" is due in 24 hours.',
      data: { assignmentId: "assignment-1" },
      channels: ["EMAIL"],
    });
  });

  it("passes undefined channels through unchanged when the schedule payload omits them", async () => {
    const enqueue = jest.fn(async () => ({}) as never);
    const notificationsService = { enqueue } as unknown as NotificationsService;
    const processor = new NotificationScheduleProcessor(notificationsService);

    const data: NotificationScheduleJobData = {
      userId: "user-2",
      eventType: "test.no-channels",
      category: "test",
      title: "T",
      body: "B",
    };

    await processor.process({ data } as Job<NotificationScheduleJobData>);

    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ channels: undefined }));
  });
});
