
import type { Response } from "express";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export type StaffEventType =
  | "SYSTEM_CONNECTED"
  | "CUSTOMER_WITHDRAWAL"
  | "CUSTOMER_TRANSFER"
  | "CUSTOMER_DEPOSIT"
  | "CUSTOMER_ACCOUNT_OPENED"
  | "CUSTOMER_LOAN_APPLIED"
  | "CUSTOMER_FD_OPENED"
  | "CUSTOMER_KYC_UPDATED"
  | "CUSTOMER_PROFILE_UPDATED"
  | "ACCOUNT_STATUS_CHANGED"
  | "CUSTOMER_TRANSACTION";

export interface StaffLiveEvent {
  id: string;
  type: StaffEventType;
  title: string;
  message: string;
  severity: "info" | "warning" | "success" | "critical";
  timestamp: string;
  data: {
    [key: string]: unknown;
  };
}

type NewStaffEvent = Omit<StaffLiveEvent, "id" | "timestamp"> & {
  id?: string;
  timestamp?: string;
};

class StaffEventBus extends EventEmitter {
  private clients = new Set<Response>();
  private recentEvents: StaffLiveEvent[] = [];
  private readonly maxStoredEvents = 100;
  private readonly heartbeatTimer: ReturnType<typeof setInterval>;

  constructor() {
    super();

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, 20_000);

    // This timer should not prevent the Node process from exiting.
    this.heartbeatTimer.unref?.();
  }

  public registerClient(res: Response): void {
    this.clients.add(res);

    res.on("close", () => {
      this.unregisterClient(res);
    });

    const handshake: StaffLiveEvent = {
      id: `evt_${randomUUID()}`,
      type: "SYSTEM_CONNECTED",
      title: "Core Banking Live Feed Connected",
      message: "Real-time customer operations stream is active.",
      severity: "success",
      timestamp: new Date().toISOString(),
      data: {
        activeClients: this.clients.size,
      },
    };

    this.writeEvent(res, handshake);
  }

  public unregisterClient(res: Response): void {
    this.clients.delete(res);
  }

  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public broadcast(eventData: NewStaffEvent): StaffLiveEvent {
    const event: StaffLiveEvent = {
      ...eventData,
      id: eventData.id || `evt_${randomUUID()}`,
      timestamp: eventData.timestamp || new Date().toISOString(),
      data: eventData.data || {},
    };

    this.recentEvents.unshift(event);

    if (this.recentEvents.length > this.maxStoredEvents) {
      this.recentEvents.length = this.maxStoredEvents;
    }

    for (const client of this.clients) {
      this.writeEvent(client, event);
    }

    this.emit("event", event);
    return event;
  }

  public getRecentEvents(limit = 40): StaffLiveEvent[] {
    return this.recentEvents.slice(0, Math.max(0, limit));
  }

  private writeEvent(res: Response, event: StaffLiveEvent): void {
    if (res.destroyed || res.writableEnded) {
      this.unregisterClient(res);
      return;
    }

    try {
      res.write(`id: ${event.id}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      this.unregisterClient(res);
      res.destroy();
    }
  }

  private sendHeartbeat(): void {
    for (const client of this.clients) {
      if (client.destroyed || client.writableEnded) {
        this.unregisterClient(client);
        continue;
      }

      try {
        client.write(`: heartbeat ${Date.now()}\n\n`);
      } catch {
        this.unregisterClient(client);
        client.destroy();
      }
    }
  }
}

export const staffEventBus = new StaffEventBus();

export function broadcastStaffEvent(eventData: NewStaffEvent): StaffLiveEvent {
  return staffEventBus.broadcast(eventData);
}
