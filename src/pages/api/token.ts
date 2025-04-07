import { NextApiRequest, NextApiResponse } from "next";
import { generateRandomAlphanumeric } from "@/lib/util";

import { AccessToken } from "livekit-server-sdk";
import type { AccessTokenOptions, VideoGrant } from "livekit-server-sdk";
import { TokenResult } from "../../lib/types";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;

const createToken = (userInfo: AccessTokenOptions, grant: VideoGrant) => {
  const at = new AccessToken(apiKey, apiSecret, userInfo);
  at.addGrant(grant);
  return at.toJwt();
};

export default async function handleToken(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (!apiKey || !apiSecret) {
      res.statusMessage = "Environment variables aren't set up correctly";
      res.status(500).end();
      return;
    }

    const roomName = `room-${generateRandomAlphanumeric(4)}-${generateRandomAlphanumeric(4)}`;

    // Get brdge_id and userId from query params
    const brdgeId = req.query.brdge_id as string;
    const userId = req.query.user_id as string;

    // Include userId in the identity if available
    let identity;
    if (brdgeId) {
      if (userId) {
        // Format: brdge-BRDGE_ID-USER_ID
        identity = `brdge-${brdgeId}-${userId}`;
      } else {
        // Fallback to previous format with random ID if no userId
        identity = `brdge-${brdgeId}-${generateRandomAlphanumeric(4)}`;
      }
    } else {
      identity = `brdge-${generateRandomAlphanumeric(4)}`;
    }

    const grant: VideoGrant = {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    };

    const token = await createToken({ identity }, grant);
    const result: TokenResult = {
      identity,
      accessToken: token,
    };

    res.status(200).json(result);
  } catch (e) {
    res.statusMessage = (e as Error).message;
    res.status(500).end();
  }
}