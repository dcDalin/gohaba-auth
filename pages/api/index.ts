import admin from "firebase-admin";
import type { NextApiRequest, NextApiResponse } from "next";

const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? JSON.parse(process.env.FIREBASE_PRIVATE_KEY)
  : undefined;

let error = null;

const extractToken = (bearerToken) => {
  const regex = /^(Bearer) (.*)$/g;
  const match = regex.exec(bearerToken);
  if (match && match[2]) {
    return match[2];
  }
  return null;
};

// Initialize the Firebase admin SDK with your service account credentials
if (privateKey) {
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    }
  } catch (err) {
    error = err;
    console.error("Something went wrong: ", err);
  }
}

const webhook = async (req: NextApiRequest, res: NextApiResponse) => {
  try {
    console.log("One is fired");
    // Throw 500 if firebase is not configured
    if (!privateKey) {
      res.status(500).send("Firebase not configured");
      return;
    }

    // Check for errors initializing firebase SDK
    if (error) {
      res.status(500).send("Invalid firebase configuration");
      return;
    }

    // Get authorization headers
    const authHeaders = req.headers["Authorization"];

    console.log("************** webhook");
    // Send anonymous role if there are no auth headers
    if (!authHeaders) {
      res.json({ "x-hasura-role": "anonymous" });
      return;
    } else {
      // Validate the received id_token
      const idToken = extractToken(authHeaders);
      console.log(idToken);
      admin
        .auth()
        .verifyIdToken(idToken)
        .then((decodedToken) => {
          const hasuraVariables = {
            "X-Hasura-User-Id": decodedToken.uid,
            "X-Hasura-Role": "user",
          };
          console.log(hasuraVariables); // For debug
          // Send appropriate variables
          res.json(hasuraVariables);
        })
        .catch((e) => {
          // Throw authentication error
          console.log(e);
          res.json({ "x-hasura-role": "anonymous" });
        });
    }
  } catch (e) {
    console.log("Error is: *********************: ", e);
    return res.status(500).json({ error: "Unexpected error." });
  }
  return res.status(200).json({ success: true });
};

export default webhook;
