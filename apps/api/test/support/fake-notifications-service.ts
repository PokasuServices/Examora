import { NotificationQueueService } from "../../src/notifications/notification-queue.service";
import { NotificationsService } from "../../src/notifications/notifications.service";

/**
 * `NotificationsService` transitively needs a real BullMQ `Queue` (via
 * `NotificationQueueService`'s `@InjectQueue`), which a minimal
 * `Test.createTestingModule({ providers: [...] })` — the pattern every
 * pre-Sprint-9 integration spec uses — has no Redis connection to satisfy.
 * Every spec that constructs a service depending on `NotificationsService`
 * (directly or transitively, e.g. via `EnrollmentService`) substitutes this
 * no-op double instead of pulling in the real queue/Redis stack, mirroring
 * how `FakePaymentGatewayService`/`FakeStorageService` stand in for other
 * external-system ports in tests.
 */
export function fakeNotificationsServiceProvider() {
  return {
    provide: NotificationsService,
    useValue: {
      enqueue: async () => undefined,
      broadcast: async () => ({ count: 0 }),
      listMine: async () => ({ items: [], total: 0 }),
      getUnreadCount: async () => 0,
      markRead: async () => undefined,
      markAllRead: async () => undefined,
      listAll: async () => ({ items: [], total: 0 }),
      getByIdOrThrow: async () => undefined,
      getMineDetailOrThrow: async () => undefined,
    },
  };
}

/** Same rationale as `fakeNotificationsServiceProvider` — `NotificationQueueService` needs `@InjectQueue`. */
export function fakeNotificationQueueServiceProvider() {
  return {
    provide: NotificationQueueService,
    useValue: {
      enqueueDelivery: async () => undefined,
      scheduleNotification: async () => undefined,
    },
  };
}
