import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  sendInvitationEmail,
  sendInviteeResponseToNedEmail,
  sendRequestConfirmationEmail,
  sendRequestUpdateEmail,
} from "./email.server";

export const sendRequestConfirmation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        name: z.string().min(1).max(200),
        pitch: z.string().max(2000),
        venue: z.string().max(300),
        when: z.string().max(200),
        trackingUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return sendRequestConfirmationEmail(data);
  });

export const sendRequestUpdate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        name: z.string().min(1).max(200),
        status: z.enum(["approved", "rejected"]),
        comment: z.string().max(2000).optional().nullable(),
        venue: z.string().max(300),
        when: z.string().max(200),
        trackingUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return sendRequestUpdateEmail(data);
  });

export const sendInvitation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        to: z.string().email(),
        name: z.string().min(1).max(200),
        hangoutTitle: z.string().min(1).max(300),
        pitch: z.string().max(2000).optional().nullable(),
        venue: z.string().max(300),
        when: z.string().max(200),
        inviteUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return sendInvitationEmail(data);
  });

export const sendInviteeResponseToNed = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        inviteeName: z.string().min(1).max(200),
        inviteeEmail: z.string().email(),
        response: z.enum(["accepted", "declined", "maybe"]),
        comment: z.string().max(2000).optional().nullable(),
        hangoutTitle: z.string().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    return sendInviteeResponseToNedEmail(data);
  });
