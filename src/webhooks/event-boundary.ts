export interface NormalizedWebhookDelivery {
  readonly deliveryId: string;
  readonly event: string;
  readonly action?: string;
  readonly payload: unknown;
}
