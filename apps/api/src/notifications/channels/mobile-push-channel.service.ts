import { Injectable } from "@nestjs/common";
import type { ChannelSendResult, MobilePushChannelPort } from "../ports/channel-sender.port";

/**
 * Interface-only stub (ADR-0004/0019 §6) — Mobile Push is tied to a native
 * app, a PRD-01 §9 non-goal for this release. No fan-out logic in
 * NotificationsService ever selects MOBILE_PUSH as a delivery channel today;
 * this class exists purely so the port shape is ready for a real adapter
 * (FCM/APNs) later without an interface change.
 */
@Injectable()
export class MobilePushChannelService implements MobilePushChannelPort {
  async send(): Promise<ChannelSendResult> {
    await Promise.resolve();
    return { success: false, error: "Mobile Push has no live integration yet (ADR-0019 §6)" };
  }
}
