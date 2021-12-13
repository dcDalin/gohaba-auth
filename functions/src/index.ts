import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp(functions.config().firebase);

export const userSignUp = functions.auth.user().onCreate(async (user) => {
  const customClaims = {
    "https://hasura.io/jwt/claims": {
      "x-hasura-allowed-roles": ["user", "anonymous"],
      "x-hasura-default-role": "user",
      "x-hasura-user-id": user.uid,
    },
  };

  try {
    await admin.auth().setCustomUserClaims(user.uid, customClaims);
    const metadataRef = admin.database().ref("/metadata/" + user.uid);

    return metadataRef.set({ refreshTime: new Date().getTime() });
  } catch (error) {
    console.error({ error });
  }
});
