import { Injectable, Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

/**
 * Live deployment log/status stream. Clients connect and subscribe to a
 * deploymentId "room"; the deployment processor broadcasts into that room
 * as it works through the pipeline. This is what powers the live terminal
 * on the deployment-in-progress screen.
 */
@Injectable()
@WebSocketGateway({
  namespace: "/deployments",
  cors: { origin: process.env.WEB_APP_URL ?? "http://localhost:3000", credentials: true },
})
export class DeploymentsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger("DeploymentsGateway");

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  @SubscribeMessage("subscribe")
  handleSubscribe(client: Socket, deploymentId: string) {
    client.join(this.room(deploymentId));
  }

  @SubscribeMessage("unsubscribe")
  handleUnsubscribe(client: Socket, deploymentId: string) {
    client.leave(this.room(deploymentId));
  }

  emitLog(deploymentId: string, log: { level: string; message: string; timestamp: string }) {
    this.server?.to(this.room(deploymentId)).emit("log", log);
  }

  emitStatus(deploymentId: string, status: { status: string; progressPct: number; currentStep: string | null }) {
    this.server?.to(this.room(deploymentId)).emit("status", status);
  }

  private room(deploymentId: string) {
    return `deployment:${deploymentId}`;
  }
}
