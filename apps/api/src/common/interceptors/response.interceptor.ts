import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

/** Wraps every successful controller return value in the standard API envelope. */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === "object" && "success" in data) {
          return data;
        }
        if (data && typeof data === "object" && "items" in data && "meta" in data) {
          const { items, meta } = data as { items: unknown; meta: unknown };
          return { success: true, data: items, meta };
        }
        return { success: true, data: data ?? null };
      }),
    );
  }
}
